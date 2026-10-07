import Link from "next/link";
import { Suspense } from "react";
import { ReplayView } from "@/components/ReplayView";

// Route: /replay/2024/2
//
// With Cache Components on, reading route params is "runtime data", so it
// happens inside <Suspense>: the page shell can be prerendered and the
// fallback shows while the params resolve.
export default function ReplayPage({ params }: PageProps<"/replay/[year]/[round]">) {
  return (
    <Suspense fallback={<FullScreenMessage>Loading race…</FullScreenMessage>}>
      <ReplayRoute params={params} />
    </Suspense>
  );
}

async function ReplayRoute({ params }: { params: PageProps<"/replay/[year]/[round]">["params"] }) {
  const { year, round } = await params;
  const y = Number(year);
  const r = Number(round);
  if (!Number.isInteger(y) || !Number.isInteger(r) || y < 2018 || r < 1 || r > 30) {
    return (
      <FullScreenMessage>
        &quot;{year}/{round}&quot; isn&apos;t a valid race. <Link href="/" className="underline">Pick a race</Link>
      </FullScreenMessage>
    );
  }
  return <ReplayView year={y} round={r} />;
}

function FullScreenMessage({ children }: { children: React.ReactNode }) {
  return <main id="main" className="flex flex-1 items-center justify-center p-10 text-dim">{children}</main>;
}
