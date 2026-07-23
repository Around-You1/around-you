import LogoPlaceholder from "./LogoPlaceholder";

const LOGO_W = 200;
const LOGO_H = 200;

interface Props {
  allowUpload?: boolean;
}

export default function AppLogo({ allowUpload = false }: Props) {
  if (!allowUpload) {
    return (
      <div style={{ display: "flex", justifyContent: "center" }}>
        <img
          src="/logo.png"
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
