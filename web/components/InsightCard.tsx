// Shared frame for every Insights panel.
export function InsightCard({ title, children, aside }: {
  title: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section aria-label={title}
      className="pointer-events-auto rounded-lg border border-line/70 bg-panel/95 p-3 shadow-lg backdrop-blur">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-xs font-bold tracking-wider text-dim">{title.toUpperCase()}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="py-2 text-sm text-faint">{children}</p>;
}
