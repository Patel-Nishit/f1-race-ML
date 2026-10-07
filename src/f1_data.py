import os
import sys
import fastf1
import fastf1.plotting
from multiprocessing import Pool, cpu_count
import numpy as np
import pickle
from datetime import timedelta

from src.lib.tyres import get_tyre_compound_int
from src.lib.time import parse_time_string, format_time
from src.race_status import detect_retirements, is_finisher
from src.race_store import RaceData, is_prepared, load_race, save_race
from src.safety_car import compute_safety_car
from src.track import build_track_outline, find_pit_points
from src.transform import (compute_positions, correct_lap1_progress, expand_intervals, make_timeline,
                           resample_linear, resample_step)

import pandas as pd

def enable_cache():
    # Check if cache folder exists
    if not os.path.exists('.fastf1-cache'):
        os.makedirs('.fastf1-cache')

    # Enable local cache
    fastf1.Cache.enable_cache('.fastf1-cache')

FPS = 10  # samples per second stored on disk; viewers interpolate between them
DT = 1 / FPS


def _process_single_driver(args):
    """Extract one driver's whole-race telemetry - top-level for multiprocessing.

    Laps are fetched one by one and glued together. Two running totals turn
    per-lap values into whole-race values:
      * dist     - metres since the start (sum of completed laps + this lap)
      * progress - laps completed as a float, (lap - 1) + fraction of this lap
    """
    driver_no, session, driver_code = args

    print(f"Getting telemetry for driver: {driver_code}")

    laps_driver = session.laps.pick_drivers(driver_no)
    if laps_driver.empty:
        return None

    columns = {name: [] for name in
               ("t", "x", "y", "dist", "progress", "lap", "tyre",
                "speed", "gear", "drs", "throttle", "brake")}
    total_dist_so_far = 0.0

    for _, lap in laps_driver.iterlaps():
        lap_tel = lap.get_telemetry()
        if lap_tel.empty:
            continue
        lap_number = int(lap.LapNumber)
        d_lap = lap_tel["Distance"].to_numpy()
        n = len(lap_tel)

        columns["t"].append(lap_tel["SessionTime"].dt.total_seconds().to_numpy())
        columns["x"].append(lap_tel["X"].to_numpy())
        columns["y"].append(lap_tel["Y"].to_numpy())
        columns["dist"].append(total_dist_so_far + d_lap)
        columns["progress"].append((lap_number - 1) + np.clip(lap_tel["RelativeDistance"].to_numpy(), 0, 0.9999))
        columns["lap"].append(np.full(n, lap_number))
        columns["tyre"].append(np.full(n, get_tyre_compound_int(lap.Compound)))
        columns["speed"].append(lap_tel["Speed"].to_numpy())
        columns["gear"].append(lap_tel["nGear"].to_numpy())
        columns["drs"].append(lap_tel["DRS"].to_numpy())
        columns["throttle"].append(lap_tel["Throttle"].to_numpy())
        columns["brake"].append(lap_tel["Brake"].to_numpy().astype(float))

        total_dist_so_far += d_lap.max() if n else 0.0

    if not columns["t"]:
        return None

    data = {name: np.concatenate(parts).astype(float) for name, parts in columns.items()}

    # Sort by time and drop duplicate timestamps (lap boundaries can repeat one)
    order = np.argsort(data["t"], kind="stable")
    data = {name: arr[order] for name, arr in data.items()}
    _, unique_idx = np.unique(data["t"], return_index=True)
    data = {name: arr[unique_idx] for name, arr in data.items()}

    print(f"Completed telemetry for driver: {driver_code}")
    return {"code": driver_code, "data": data}


def load_session(year, round_number, session_type='R'):
    # session_type: 'R' (Race), 'S' (Sprint) etc.
    session = fastf1.get_session(year, round_number, session_type)
    session.load(telemetry=True, weather=True)
    return session


# The following functions require a loaded session object

def get_driver_colors(session):
    color_mapping = fastf1.plotting.get_driver_color_mapping(session)

    # Convert hex colors to RGB tuples
    rgb_colors = {}
    for driver, hex_color in color_mapping.items():
        hex_color = hex_color.lstrip('#')
        rgb = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
        rgb_colors[driver] = rgb
    return rgb_colors


def get_circuit_rotation(session):
    circuit = session.get_circuit_info()
    return circuit.rotation


def _driver_info(session, codes):
    """Driver metadata for meta.json, in starting-grid order."""
    colors = get_driver_colors(session)
    results = session.results.set_index("Abbreviation")
    drivers = []
    for code in codes:
        row = results.loc[code] if code in results.index else None
        grid = int(row["GridPosition"]) if row is not None and pd.notna(row["GridPosition"]) else 0
        drivers.append({
            "code": code,
            "number": str(row["DriverNumber"]) if row is not None else "",
            "name": str(row["FullName"]) if row is not None else code,
            "team": str(row["TeamName"]) if row is not None else "",
            "color": "#%02x%02x%02x" % colors.get(code, (128, 128, 128)),
            "grid": grid if grid > 0 else 99,  # 0 = pit lane start
            "status": str(row["Status"]) if row is not None else "",
            "final_position": int(row["Position"]) if row is not None and pd.notna(row["Position"]) else 99,
        })
    drivers.sort(key=lambda d: d["grid"])
    return drivers


def _resample_weather(session, timeline, t0):
    """Weather is sampled about once a minute; put it on our timeline too."""
    weather = getattr(session, "weather_data", None)
    if weather is None or weather.empty:
        return {}
    wt = weather["Time"].dt.total_seconds().to_numpy() - t0
    order = np.argsort(wt)
    wt = wt[order]
    out = {}
    for name, column in (("air_temp", "AirTemp"), ("track_temp", "TrackTemp"),
                         ("humidity", "Humidity"), ("wind_speed", "WindSpeed")):
        if column in weather:
            out[name] = resample_linear(timeline, wt, weather[column].to_numpy(dtype=float)[order])
    if "Rainfall" in weather:
        out["rainfall"] = resample_step(timeline, wt, weather["Rainfall"].to_numpy().astype(np.int8)[order])
    return out


def prepare_race(year, round_number, session_type='R', refresh=False, progress=None) -> RaceData:
    """Run the whole race pipeline (or load it from computed_data/).

    progress: optional callback progress(stage: str, fraction: float), used by
    the CLI and later by the backend to show a progress bar.
    """
    def report(stage, fraction):
        print(f"[{fraction:4.0%}] {stage}")
        if progress:
            progress(stage, fraction)

    if not refresh and is_prepared(year, round_number, session_type):
        report("Loaded from computed_data/", 1.0)
        return load_race(year, round_number, session_type)

    # ---- Extract ---------------------------------------------------------
    enable_cache()
    report("Loading session from FastF1", 0.0)
    session = load_session(year, round_number, session_type)

    drivers = session.drivers
    driver_codes = {num: session.get_driver(num)["Abbreviation"] for num in drivers}

    report(f"Extracting telemetry for {len(drivers)} drivers", 0.3)
    driver_args = [(num, session, driver_codes[num]) for num in drivers]
    with Pool(processes=min(cpu_count(), len(drivers))) as pool:
        results = [r for r in pool.map(_process_single_driver, driver_args) if r is not None]
    if not results:
        raise ValueError("No valid telemetry data found for any driver")
    raw = {r["code"]: r["data"] for r in results}

    # ---- Transform: one shared clock ---------------------------------------
    report("Resampling onto a 10 Hz timeline", 0.7)
    info = _driver_info(session, list(raw.keys()))
    codes = [d["code"] for d in info]  # grid order = column order

    t0 = min(raw[c]["t"][0] for c in codes)
    t1 = max(raw[c]["t"][-1] for c in codes)
    timeline = make_timeline(t0, t1, FPS)
    n, d = len(timeline), len(codes)

    linear_fields = ("x", "y", "dist", "progress", "speed", "throttle", "brake")
    step_fields = ("lap", "tyre", "gear", "drs")
    arrays = {name: np.zeros((n, d)) for name in linear_fields + step_fields}
    for j, code in enumerate(codes):
        data = raw[code]
        t = data["t"] - t0
        for name in linear_fields:
            arrays[name][:, j] = resample_linear(timeline, t, data[name])
        for name in step_fields:
            arrays[name][:, j] = resample_step(timeline, t, data[name])

    track = build_track_outline(session)
    grid = np.array([i["grid"] for i in info], dtype=float)
    arrays["progress"] = correct_lap1_progress(
        arrays["progress"], arrays["lap"], grid, track["lap_length"])

    # ---- Transform: who's OUT, who's finished, race order ----------------
    last_seen = {c: float(raw[c]["t"][-1] - t0) for c in codes}
    retirements = detect_retirements({i["code"]: i["status"] for i in info}, last_seen)
    t_col = timeline[:, np.newaxis]
    out = t_col >= np.array([retirements.get(c, np.inf) for c in codes])
    # "- DT": the timeline can stop a fraction of a frame before the last sample
    finished = (t_col >= np.array([last_seen[c] for c in codes]) - DT) & np.array(
        [is_finisher(i["status"]) for i in info])
    final_position = np.array([i["final_position"] for i in info], dtype=float)
    # Rank by laps completed + fraction of the current lap, not raw metres:
    # cars further back on the grid drive a longer lap 1, and that extra
    # distance would otherwise stay in their total for the whole race.
    arrays["position"] = compute_positions(arrays["progress"], out, finished, final_position)

    total_laps = int(max(raw[c]["lap"].max() for c in codes))
    leader = np.argmin(arrays["position"], axis=1)
    rows = np.arange(n)
    arrays["leader_lap"] = np.clip(arrays["lap"][rows, leader], 1, total_laps)

    # ---- Transform: track, track status, safety car -----------------------
    report("Building track and safety car", 0.85)
    track.update(find_pit_points(session, {c: raw[c] for c in codes}))

    status_df = session.track_status
    starts = status_df["Time"].dt.total_seconds().to_numpy() - t0
    status_codes = status_df["Status"].astype(int).to_numpy()
    arrays["track_status"] = expand_intervals(starts, status_codes, timeline, default=1)

    sc_x, sc_y, sc_state = compute_safety_car(
        arrays["track_status"], arrays["progress"][rows, leader], track,
        track["pit_exit"], track["pit_entry"], FPS)
    arrays.update(sc_x=sc_x, sc_y=sc_y, sc_state=sc_state)
    arrays.update(_resample_weather(session, timeline, t0))
    arrays["t"] = timeline

    # ---- Load ------------------------------------------------------------
    meta = {
        "year": year,
        "round": round_number,
        "session": session_type,
        "event_name": str(session.event["EventName"]),
        "country": str(session.event["Country"]),
        "fps": FPS,
        "n_frames": n,
        "duration": float(timeline[-1]),
        "total_laps": total_laps,
        "drivers": info,
        "retirements": retirements,
        "track": track,
        "track_status_changes": [
            {"t": round(float(s), 2), "status": int(c)} for s, c in zip(starts, status_codes)
        ],
    }
    race = RaceData(arrays=arrays, meta=meta)
    report("Saving to computed_data/", 0.95)
    save_race(race, year, round_number, session_type)
    report("Done", 1.0)
    return load_race(year, round_number, session_type)


def get_qualifying_results(session):

    # Extract the qualifying results and return a list of the drivers, their positions and their lap times in each qualifying segment

    results = session.results

    qualifying_data = []

    for _, row in results.iterrows():
        driver_code = row["Abbreviation"]
        position = int(row["Position"])
        q1_time = row["Q1"]
        q2_time = row["Q2"]
        q3_time = row["Q3"]

        # Convert pandas Timedelta objects to seconds (or None if NaT)
        def convert_time_to_seconds(time_val) -> str:
            if pd.isna(time_val):
                return None
            return str(time_val.total_seconds())    

        qualifying_data.append({
            "code": driver_code,
            "position": position,
            "color": get_driver_colors(session).get(driver_code, (128,128,128)),
            "Q1": convert_time_to_seconds(q1_time),
            "Q2": convert_time_to_seconds(q2_time),
            "Q3": convert_time_to_seconds(q3_time),
        })
    return qualifying_data

def get_driver_quali_telemetry(session, driver_code: str, quali_segment: str):

    # Split Q1/Q2/Q3 sections
    q1, q2, q3 = session.laps.split_qualifying_sessions()

    segments = {
        "Q1": q1,
        "Q2": q2,
        "Q3": q3
    }

    # Validate the segment
    if quali_segment not in segments:
        raise ValueError("quali_segment must be 'Q1', 'Q2', or 'Q3'")

    segment_laps = segments[quali_segment]
    if segment_laps is None:
        raise ValueError(f"{quali_segment} does not exist for this session.")

    # Filter laps for the driver
    driver_laps = segment_laps.pick_drivers(driver_code)
    if driver_laps.empty:
        raise ValueError(f"No laps found for driver '{driver_code}' in {quali_segment}")

    # Pick fastest lap
    fastest_lap = driver_laps.pick_fastest()

    # Extract telemetry with xyz coordinates

    if fastest_lap is None:
        raise ValueError(f"No valid laps for driver '{driver_code}' in {quali_segment}")

    telemetry = fastest_lap.get_telemetry()

    # Guard: if telemetry has no time data, return empty
    if telemetry is None or telemetry.empty or 'Time' not in telemetry or len(telemetry) == 0:
        return {"frames": [], "track_statuses": []}

    global_t_min = telemetry["Time"].dt.total_seconds().min()
    global_t_max = telemetry["Time"].dt.total_seconds().max()

    max_speed = telemetry["Speed"].max()
    min_speed = telemetry["Speed"].min()

    # An array of objects containing the start and end disances of each time the driver used DRS during the lap
    lap_drs_zones = []

    # Build arrays directly from dataframes
    t_arr = telemetry["Time"].dt.total_seconds().to_numpy()
    x_arr = telemetry["X"].to_numpy()
    y_arr = telemetry["Y"].to_numpy()
    dist_arr = telemetry["Distance"].to_numpy()
    rel_dist_arr = telemetry["RelativeDistance"].to_numpy()
    speed_arr = telemetry["Speed"].to_numpy()
    gear_arr = telemetry["nGear"].to_numpy()
    throttle_arr = telemetry["Throttle"].to_numpy()
    brake_arr = telemetry["Brake"].to_numpy()
    drs_arr = telemetry["DRS"].to_numpy()

    # Recompute time bounds from the (possibly modified) telemetry times
    global_t_min = float(t_arr.min())
    global_t_max = float(t_arr.max())

    # Create timeline (relative times starting at zero) and include endpoint
    timeline = np.arange(global_t_min, global_t_max + DT/2, DT) - global_t_min

    # Ensure we have at least one sample
    if t_arr.size == 0:
        return {"frames": [], "track_statuses": []}

    # Shift telemetry times to same reference as timeline (relative to global_t_min)
    t_rel = t_arr - global_t_min

    # Sort & deduplicate times using the relative times
    order = np.argsort(t_rel)
    t_sorted = t_rel[order]
    t_sorted_unique, unique_idx = np.unique(t_sorted, return_index=True)
    idx_map = order[unique_idx]

    x_sorted = x_arr[idx_map]
    y_sorted = y_arr[idx_map]
    dist_sorted = dist_arr[idx_map]
    rel_dist_sorted = rel_dist_arr[idx_map]
    speed_sorted = speed_arr[idx_map]
    gear_sorted = gear_arr[idx_map]
    throttle_sorted = throttle_arr[idx_map]
    brake_sorted = brake_arr[idx_map]
    drs_sorted = drs_arr[idx_map]

    # Continuous interpolation
    x_resampled = np.interp(timeline, t_sorted_unique, x_sorted)
    y_resampled = np.interp(timeline, t_sorted_unique, y_sorted)
    dist_resampled = np.interp(timeline, t_sorted_unique, dist_sorted)
    rel_dist_resampled = np.interp(timeline, t_sorted_unique, rel_dist_sorted)
    speed_resampled = np.round(np.interp(timeline, t_sorted_unique, speed_sorted), 1)
    throttle_resampled = np.round(np.interp(timeline, t_sorted_unique, throttle_sorted), 1)
    brake_resampled = np.round(np.interp(timeline, t_sorted_unique, brake_sorted), 1)
    drs_resampled = np.interp(timeline, t_sorted_unique, drs_sorted)

    # Make sure that braking is between 0 and 100 so that it matches the throttle scale

    brake_resampled = brake_resampled * 100.0

    # Forward-fill / step sampling for discrete fields (gear)
    idxs = np.searchsorted(t_sorted_unique, timeline, side='right') - 1
    idxs = np.clip(idxs, 0, len(t_sorted_unique) - 1)
    gear_resampled = gear_sorted[idxs].astype(int)

    resampled_data = {
        "t": timeline,
        "x": x_resampled,
        "y": y_resampled,
        "dist": dist_resampled,
        "rel_dist": rel_dist_resampled,
        "speed": speed_resampled,
        "gear": gear_resampled,
        "throttle": throttle_resampled,
        "brake": brake_resampled,
        "drs": drs_resampled,
    }

    track_status = session.track_status

    formatted_track_statuses = []

    for status in track_status.to_dict('records'):
        seconds = timedelta.total_seconds(status['Time'])

        start_time = seconds - global_t_min # Shift to match timeline
        end_time = None

        # Set the end time of the previous status
        if formatted_track_statuses:
            formatted_track_statuses[-1]['end_time'] = start_time

        formatted_track_statuses.append({
            'status': status['Status'],
            'start_time': start_time,
            'end_time': end_time, 
        })

    # 4.1. Resample weather data onto the same timeline for playback
    weather_resampled = None
    weather_df = getattr(session, "weather_data", None)
    if weather_df is not None and not weather_df.empty:
        try:
            weather_times = weather_df["Time"].dt.total_seconds().to_numpy() - global_t_min
            if len(weather_times) > 0:
                order_w = np.argsort(weather_times)
                weather_times = weather_times[order_w]

                def _maybe_get(name):
                    return weather_df[name].to_numpy()[order_w] if name in weather_df else None

                def _resample(series):
                    if series is None:
                        return None
                    return np.interp(timeline, weather_times, series)

                track_temp = _resample(_maybe_get("TrackTemp"))
                air_temp = _resample(_maybe_get("AirTemp"))
                humidity = _resample(_maybe_get("Humidity"))
                wind_speed = _resample(_maybe_get("WindSpeed"))
                wind_direction = _resample(_maybe_get("WindDirection"))
                rainfall_raw = _maybe_get("Rainfall")
                rainfall = _resample(rainfall_raw.astype(float)) if rainfall_raw is not None else None

                weather_resampled = {
                    "track_temp": track_temp,
                    "air_temp": air_temp,
                    "humidity": humidity,
                    "wind_speed": wind_speed,
                    "wind_direction": wind_direction,
                    "rainfall": rainfall,
                }
        except Exception as e:
            print(f"Weather data could not be processed: {e}")

    # Build the frames
    frames = []
    num_frames = len(timeline)

    for i in range(num_frames):
        t = timeline[i]

        weather_snapshot = {}
        if weather_resampled:
            try:
                wt = weather_resampled
                rain_val = wt["rainfall"][i] if wt.get("rainfall") is not None else 0.0
                weather_snapshot = {
                    "track_temp": float(wt["track_temp"][i]) if wt.get("track_temp") is not None else None,
                    "air_temp": float(wt["air_temp"][i]) if wt.get("air_temp") is not None else None,
                    "humidity": float(wt["humidity"][i]) if wt.get("humidity") is not None else None,
                    "wind_speed": float(wt["wind_speed"][i]) if wt.get("wind_speed") is not None else None,
                    "wind_direction": float(wt["wind_direction"][i]) if wt.get("wind_direction") is not None else None,
                    "rain_state": "RAINING" if rain_val and rain_val >= 0.5 else "DRY",
                }
            except Exception as e:
                print(f"Failed to attach weather data to frame {i}: {e}")

        # Check if drs has changed from the previous frame

        if i > 0:
            drs_prev = resampled_data["drs"][i - 1]
            drs_curr = resampled_data["drs"][i]

            if (drs_curr >= 10) and (drs_prev < 10):
                # DRS activated
                lap_drs_zones.append({
                    "zone_start": float(resampled_data["dist"][i]),
                    "zone_end": None,
                })
            elif (drs_curr < 10) and (drs_prev >= 10):
                # DRS deactivated
                if lap_drs_zones and lap_drs_zones[-1]["zone_end"] is None:
                    lap_drs_zones[-1]["zone_end"] = float(resampled_data["dist"][i])

        frame_payload = {
            "t": round(t, 3),
            "telemetry": {
                "x": float(resampled_data["x"][i]),
                "y": float(resampled_data["y"][i]),
                "dist": float(resampled_data["dist"][i]),
                "rel_dist": float(resampled_data["rel_dist"][i]),
                "speed": float(resampled_data["speed"][i]),
                "gear": int(resampled_data["gear"][i]),
                "throttle": float(resampled_data["throttle"][i]),
                "brake": float(resampled_data["brake"][i]),
                "drs": int(resampled_data["drs"][i]),
            }
        }
        if weather_snapshot:
            frame_payload["weather"] = weather_snapshot

        frames.append(frame_payload)

    # Set the time of the final frame to the exact lap time
            
    frames[-1]["t"] = round(parse_time_string(str(fastest_lap["LapTime"])), 3)

    return {
        "frames": frames,
        "track_statuses": formatted_track_statuses,
        "drs_zones": lap_drs_zones,
        "max_speed": max_speed,
        "min_speed": min_speed,
    }


def _process_quali_driver(args):
    """Process qualifying telemetry data for a single driver - must be top-level for multiprocessing"""
    session, driver_code = args

    print(f"Getting qualifying telemetry for driver: {driver_code}")

    driver_telemetry_data = {}

    max_speed = 0.0
    min_speed = 0.0

    for segment in ["Q1", "Q2", "Q3"]:
        try:
            segment_telemetry = get_driver_quali_telemetry(session, driver_code, segment)
            driver_telemetry_data[segment] = segment_telemetry

            # Update global max/min speed
            if segment_telemetry["max_speed"] > max_speed:
                max_speed = segment_telemetry["max_speed"]
            if segment_telemetry["min_speed"] < min_speed or min_speed == 0.0:
                min_speed = segment_telemetry["min_speed"]

        except ValueError:
            driver_telemetry_data[segment] = {"frames": [], "track_statuses": []}

    print(f"Finished processing qualifying telemetry for driver: {driver_code}")
        
    return {
        "driver_code": driver_code,
        "driver_telemetry_data": driver_telemetry_data,
        "max_speed": max_speed,
        "min_speed": min_speed,
    }


def get_quali_telemetry(session, session_type='Q'):
    # This function is going to get the results from qualifying and the telemetry for each drivers' fastest laps in each qualifying segment

    # The structure of the returned data will be:
    # {
    #   "results": [ { "code": driver_code, "position": position, "Q1": time, "Q2": time, "Q3": time }, ... ],
    #   "telemetry": {
    #       "driver_code": {
    #           "Q1": { "frames": [ { "t": time, "x": x, "y": y, "dist": dist, "speed": speed, "gear": gear }, ... ] },
    #           "Q2": { ... },
    #           "Q3": { ... },
    #       },
    #       ...
    #   }
    # }

    event_name = str(session).replace(' ', '_')
    cache_suffix = 'sprintquali' if session_type == 'SQ' else 'quali'

    # Check if this data has already been computed
    try:
        if "--refresh-data" not in sys.argv:
            with open(f"computed_data/{event_name}_{cache_suffix}_telemetry.pkl", "rb") as f:
                data = pickle.load(f)
                print(f"Loaded precomputed {cache_suffix} telemetry data.")
                print("The replay should begin in a new window shortly!")
                return data
    except FileNotFoundError:
        pass  # Need to compute from scratch

    qualifying_results = get_qualifying_results(session)

    telemetry_data = {}

    max_speed = 0.0
    min_speed = 0.0

    driver_codes = {
        num: session.get_driver(num)["Abbreviation"]
        for num in session.drivers
    }

    telemetry_data = {}

    driver_args = [(session, driver_codes[driver_no]) for driver_no in session.drivers]

    print(f"Processing {len(session.drivers)} drivers in parallel...")
    
    num_processes = min(cpu_count(), len(session.drivers))
    
    with Pool(processes=num_processes) as pool:
        results = pool.map(_process_quali_driver, driver_args)
    for result in results:
        driver_code = result["driver_code"]
        telemetry_data[driver_code] = result["driver_telemetry_data"]

        if result["max_speed"] > max_speed:
            max_speed = result["max_speed"]
        if result["min_speed"] < min_speed or min_speed == 0.0:
            min_speed = result["min_speed"]

    # Save to the compute_data directory

    if not os.path.exists("computed_data"):
        os.makedirs("computed_data")

    with open(f"computed_data/{event_name}_{cache_suffix}_telemetry.pkl", "wb") as f:
        pickle.dump({
            "results": qualifying_results,
            "telemetry": telemetry_data,
            "max_speed": max_speed,
            "min_speed": min_speed,
        }, f, protocol=pickle.HIGHEST_PROTOCOL)

    return {
        "results": qualifying_results,
        "telemetry": telemetry_data,
        "max_speed": max_speed,
        "min_speed": min_speed,
    }


def get_race_weekends_by_year(year):
    """Returns a list of race weekends for a given year."""
    enable_cache()
    schedule = fastf1.get_event_schedule(year)
    weekends = []
    for _, event in schedule.iterrows():
        if event.is_testing():
            continue
        weekends.append({
            "round_number": event['RoundNumber'],
            "event_name": event['EventName'],
            "date": str(event['EventDate'].date()),
            "country": event['Country'],
            "type": event['EventFormat'],
        })
    return weekends

def list_rounds(year):
    """Lists all rounds for a given year."""
    enable_cache()
    print(f"F1 Schedule {year}")
    schedule = fastf1.get_event_schedule(year)
    for _, event in schedule.iterrows():
        print(f"{event['RoundNumber']}: {event['EventName']}")

def list_sprints(year):
    """Lists all sprint rounds for a given year."""
    enable_cache()
    print(f"F1 Sprint Races {year}")
    schedule = fastf1.get_event_schedule(year)
    sprint_name = 'sprint_qualifying'
    if year == 2023:
        sprint_name = 'sprint_shootout'
    if year in [2021, 2022]:
        sprint_name = 'sprint'
    sprints = schedule[schedule['EventFormat'] == sprint_name]
    if sprints.empty:
        print(f"No sprint races found for {year}.")
    else:
        for _, event in sprints.iterrows():
            print(f"{event['RoundNumber']}: {event['EventName']}")