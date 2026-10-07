import Link from "next/link";
import { Mark } from "@/components/Mark";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-[100dvh] w-full max-w-xl flex-col justify-center gap-5 px-6">
      <Mark className="h-10 w-10" />
      <h1 className="pb-1 text-4xl font-bold italic leading-[1.1] tracking-tight">Off the racing line.</h1>
      <p className="max-w-[48ch] text-dim">
        This page doesn&apos;t exist. The race you&apos;re after is probably in the calendar.
      </p>
      <Link href="/"
        className="w-fit rounded-ui bg-f1 px-5 py-2 font-semibold text-white hover:bg-f1-hover">
        Back to races
      </Link>
    </main>
  );
}
