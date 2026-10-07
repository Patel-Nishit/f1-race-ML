// Small inline SVG icons (no icon font, so they look identical everywhere).
type P = { className?: string };
const svg = (path: React.ReactNode) =>
  function Icon({ className = "h-4 w-4" }: P) {
    return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>{path}</svg>;
  };

export const PlayIcon = svg(<path d="M7 4.5v15l13-7.5z" />);
export const PauseIcon = svg(<path d="M6 4h4.5v16H6zM13.5 4H18v16h-4.5z" />);
export const RestartIcon = svg(<path d="M5 4h3v16H5zM20 4.5v15L9 12z" />);
export const BackIcon = svg(<path d="M11.5 5v14L3 12zM21 5v14l-8.5-7z" />);
export const ForwardIcon = svg(<path d="M12.5 5v14L21 12zM3 5v14l8.5-7z" />);
export const PrevLapIcon = svg(<path d="M5 5h3v14H5zM19 5v14l-10-7z" />);
export const NextLapIcon = svg(<path d="M16 5h3v14h-3zM5 5v14l10-7z" />);
export const MinusIcon = svg(<path d="M5 10.5h14v3H5z" />);
export const PlusIcon = svg(<path d="M10.5 5h3v5.5H19v3h-5.5V19h-3v-5.5H5v-3h5.5z" />);
