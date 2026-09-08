"use client";

// Unlisted YouTube tutorial — "How to sign up as a rep". Embedded inline so
// viewers stay in the app and never land on the channel. To change the video,
// upload a new Unlisted one and swap VIDEO_ID for its id (the part after
// youtu.be/ or /shorts/ or /embed/).
const VIDEO_ID = "acLSZ6CN7TI";
const LUMO = "#39FF14";

export default function RepSignupVideo({
  label = "Watch: How to sign up as a rep",
}: {
  label?: string;
}) {
  return (
    <div style={{ marginTop: 14 }}>
      <p style={{ color: LUMO, fontWeight: 700, fontSize: 13, margin: "0 0 6px" }}>{label}</p>
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 300,
          margin: "0 auto",
          aspectRatio: "392 / 850",
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid rgba(57,255,20,0.35)",
          background: "#000",
        }}
      >
        <iframe
          src={`https://www.youtube.com/embed/${VIDEO_ID}?rel=0`}
          title="How to sign up as a rep"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
        />
      </div>
    </div>
  );
}
