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
}

export default function AppLogo({ allowUpload = false, src = "/logo.png", size }: Props) {
  const dim = size ?? LOGO_W;
  if (!allowUpload) {
    return (
      <div style={{ display: "flex", justifyContent: "center" }}>
        <img
          src={src}
          alt="App Logo"
          draggable={false}
          style={{
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
          }}
        />
      </div>
    );
  }

  return <LogoPlaceholder allowUpload={allowUpload} />;
}
