import LogoPlaceholder from "./LogoPlaceholder";

const LOGO_W = 200;
const LOGO_H = 200;

interface Props {
  allowUpload?: boolean;
  // Override the logo image. Defaults to the white-text logo, which suits dark
  // backgrounds (sign-in screens). Pass the black-text asset on light pages
  // (e.g. the Partner Portal) so the "Connecting Guests…" text stays legible.
  src?: string;
}

export default function AppLogo({ allowUpload = false, src = "/logo.png" }: Props) {
  if (!allowUpload) {
    return (
      <div style={{ display: "flex", justifyContent: "center" }}>
        <img
          src={src}
          alt="App Logo"
          draggable={false}
          style={{
            width: LOGO_W,
            height: LOGO_H,
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
