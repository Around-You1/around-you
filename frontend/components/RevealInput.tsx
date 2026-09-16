"use client";

import React, { useState } from "react";

// A text input that is masked (like a password) by default with an eye button
// on the right to reveal what was typed — so users can check the spelling of
// codes / passwords they enter. Drop-in replacement for a raw <input>; all
// input props pass through, and the incoming `type` is ignored (the eye
// controls masking).
export default function RevealInput(
  props: React.InputHTMLAttributes<HTMLInputElement>
) {
  const { style, type: _ignored, ...rest } = props;
  const [show, setShow] = useState(false);

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <input
        {...rest}
        type={show ? "text" : "password"}
        style={{ ...(style as React.CSSProperties), width: "100%", paddingRight: 42, boxSizing: "border-box" }}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide" : "Show"}
        title={show ? "Hide" : "Show"}
        tabIndex={-1}
        style={{
          position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
          background: "transparent", border: "none", padding: 4, margin: 0,
          cursor: "pointer", color: "#9aa19a", lineHeight: 0,
        }}
      >
        {show ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a13.16 13.16 0 0 1-1.67 2.68" />
            <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 8 10 8a9.74 9.74 0 0 0 5.39-1.61" />
            <line x1="2" y1="2" x2="22" y2="22" />
            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
