import Link from "next/link";
import { GithubLogoIcon } from "@phosphor-icons/react/ssr";
import { Mark } from "../Mark";
import { TeamThemeToggle } from "./TeamThemeToggle";

export const REPO_URL = "https://github.com/Patel-Nishit/f1-race-ML";

export function TopNav() {
  return (
    <header className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between px-4 md:px-8">
      <Link href="/" className="flex items-center gap-2.5 rounded-ui font-bold tracking-tight">
        <Mark className="h-6 w-7" />
        F1 Race Replay
      </Link>
      <div className="flex items-center gap-2 sm:gap-4">
        <TeamThemeToggle />
        <a href={REPO_URL} className="flex items-center gap-2 rounded-ui px-2 py-1 text-sm text-dim hover:text-ink">
          <GithubLogoIcon size={18} aria-hidden="true" />
          <span className="hidden sm:inline">Source</span>
        </a>
      </div>
    </header>
  );
}
