import { RacePicker } from "@/components/RacePicker";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-10 border-l-4 border-f1 pl-4">
        <h1 className="text-4xl font-black tracking-tight">F1 RACE REPLAY</h1>
        <p className="mt-1 text-dim">
          Pick a race. Prepared races open instantly; others take a few minutes to download and process.
        </p>
      </header>
      <RacePicker />
    </main>
  );
}
