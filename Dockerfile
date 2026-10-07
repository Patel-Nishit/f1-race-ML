# API server image: FastAPI + WebSocket replay, with demo races baked in.
#
#   docker build -t f1-replay-api .
#   docker run -p 8000:8000 -e F1_CORS_ORIGINS=http://localhost:3000 f1-replay-api
#
# Hosts like Render, Fly.io or Railway build this straight from the repo.
FROM python:3.12-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HOST=0.0.0.0 \
    PORT=8000 \
    F1_DATA_DIR=/app/computed_data

# Dependencies first: this layer is cached until requirements change.
COPY requirements-api.txt .
RUN pip install -r requirements-api.txt

COPY main.py ./
COPY src ./src
COPY backend ./backend

# Prepare the demo races at build time, so the image is self-contained and
# the public server never has to run the slow pipeline. The FastF1 download
# cache is deleted in the same step to keep the image small.
# Override with: docker build --build-arg DEMO_RACES="2024:1 2023:5" .
ARG DEMO_RACES="2024:1 2024:2 2024:3"
ARG F1_WORKERS=2
RUN for race in $DEMO_RACES; do \
        F1_WORKERS=$F1_WORKERS python main.py prepare --year "${race%%:*}" --round "${race##*:}" || exit 1; \
    done \
    && rm -rf .fastf1-cache

# Public deployments only replay the shipped races (see backend/app.py).
ENV F1_ALLOW_PREPARE=false

EXPOSE 8000
CMD ["python", "main.py", "serve"]
