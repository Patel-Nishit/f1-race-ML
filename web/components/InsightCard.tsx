// Shared frame for every Insights panel.
export function InsightCard({ title, children, aside }: {
  title: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section aria-label={title}
      className="pointer-events-auto rounded-ui border border-line bg-panel p-3 lg:glass">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="py-2 text-sm text-dim">{children}</p>;
}
