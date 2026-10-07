import { REPO_URL } from "./TopNav";

export function Footer() {
  return (
    <footer className="mx-auto mt-24 w-full max-w-[1400px] border-t border-line px-4 py-8 text-sm text-dim md:px-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <p>
          Timing data from{" "}
          <a href="https://github.com/theOehrly/Fast-F1" className="text-ink underline-offset-4 hover:underline">FastF1</a>.
          A fan project, not affiliated with Formula 1.
        </p>
        <a href={REPO_URL} className="text-ink underline-offset-4 hover:underline">View the source</a>
      </div>
    </footer>
  );
}
