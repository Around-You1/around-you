import LogoPlaceholder from "./LogoPlaceholder";

const LOGO_W = 200;
const LOGO_H = 200;

interface Props {
  allowUpload?: boolean;
  // Optional pixel size (width & height). Defaults to 200 so existing
  // callers are unchanged; pass a smaller value on space-tight mobile screens.
  size?: number;
  // Override the logo image. Defaults to the white-text logo, which suits dark
  // backgrounds (sign-in screens). Pass the black-text asset on light pages
  // (e.g. the Partner Portal) so the "Connecting Guests…" text stays legible.
  src?: string;
  // Theme-aware: show the dark-text logo in light mode and the white-text logo
  // in dark mode. Used on pages that follow the light/dark setting.
  themed?: boolean;
}

export default function AppLogo({ allowUpload = false, src, size, themed = false }: Props) {
  const dim = size ?? LOGO_W;
  if (!allowUpload) {
    const base = {
      width: dim,
      height: dim,
      maxWidth: "100%",
      objectFit: "contain",
      border: "none",
      outline: "none",
      boxShadow: "none",
      background: "transparent",
      userSelect: "none",
      pointerEvents: "none",
    } as const;
    if (themed && !src) {
      // Dark-text logo on light backgrounds, white-text logo on dark ones.
      return (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <img src="/logo-dark.png" alt="App Logo" draggable={false} className="block dark:hidden" style={base} />
          <img src="/logo.png" alt="App Logo" draggable={false} className="hidden dark:block" style={base} />
        </div>
      );
    }
    return (
      <div style={{ display: "flex", justifyContent: "center" }}>
        <img src={src ?? "/logo.png"} alt="App Logo" draggable={false} style={base} />
      </div>
    );
  }

  return <LogoPlaceholder allowUpload={allowUpload} />;
}
