// The F1 Race Replay mark: three slanted bars, the same lean as the slanted
// chips used across the UI. Also the favicon (app/icon.svg).
export function Mark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="6 6 24 20" className={className} aria-hidden="true">
      <path d="M9 23 L15 9 H19 L13 23 Z" fill="var(--accent)" />
      <path d="M15 23 L21 9 H24 L18 23 Z" fill="var(--accent)" opacity="0.7" />
      <path d="M20 23 L26 9 H28 L22 23 Z" fill="var(--accent)" opacity="0.45" />
    </svg>
  );
}
