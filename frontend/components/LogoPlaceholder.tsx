import { useState, useRef, useCallback, useEffect } from "react";
import backend from "~backend/client";

const LOGO_URL_KEY = "app_logo_url";
const LOGO_W = 200;
const LOGO_H = 200;

function getStoredUrl(): string {
  try {
    return localStorage.getItem(LOGO_URL_KEY) ?? "";
  } catch {
    return "";
  }
}

function setStoredUrl(url: string) {
  try {
    localStorage.setItem(LOGO_URL_KEY, url);
  } catch {
  }
}

interface Props {
  allowUpload?: boolean;
}

export default function LogoPlaceholder({ allowUpload = false }: Props) {
  const [logoUrl, setLogoUrl] = useState<string>(getStoredUrl);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [imageError, setImageError] = useState<boolean>(false);
  const [apiLoading, setApiLoading] = useState<boolean>(!getStoredUrl());
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    backend.storage.getLogo().then((res) => {
      if (res.url) {
        setLogoUrl(res.url);
        setStoredUrl(res.url);
        setImageError(false);
      }
    }).catch(() => {}).finally(() => {
      setApiLoading(false);
    });
  }, []);

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await backend.storage.setLogo({ data: dataUrl, contentType: file.type });
      setLogoUrl(res.url);
      setStoredUrl(res.url);
      setImageLoaded(false);
      setImageError(false);
    } catch (err) {
      console.error("Logo upload failed:", err);
    } finally {
      setUploading(false);
    }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (!allowUpload) return;
    e.preventDefault();
    setDragging(true);
  }, [allowUpload]);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragging(false);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    if (!allowUpload) return;
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [allowUpload, processFile]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  }, [processFile]);

  const hasLogo = Boolean(logoUrl) && !imageError;

  if (hasLogo) {
    return (
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div
          style={{
            width: LOGO_W,
            height: LOGO_H,
            maxWidth: "100%",
            position: "relative",
            cursor: allowUpload ? "pointer" : "default",
            opacity: uploading ? 0.5 : 1,
            transition: "opacity 0.2s",
          }}
          onClick={() => allowUpload && inputRef.current?.click()}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          title={allowUpload ? "Click or drag to replace logo" : undefined}
        >
          <img
            src={logoUrl}
            alt="App Logo"
            draggable={false}
            onLoad={() => setImageLoaded(true)}
            onError={() => {
              setImageError(true);
              setImageLoaded(false);
            }}
            style={{
              width: LOGO_W,
              height: LOGO_H,
              maxWidth: "100%",
              objectFit: "contain",
              display: imageLoaded ? "block" : "none",
              border: "none",
              outline: "none",
              boxShadow: "none",
              background: "transparent",
              userSelect: "none",
              pointerEvents: "none",
            }}
          />
          {!imageLoaded && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  border: "3px solid rgba(57,255,20,0.2)",
                  borderTopColor: "#39FF14",
                  animation: "spin 0.8s linear infinite",
                }}
              />
            </div>
          )}
          {allowUpload && dragging && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(57,255,20,0.15)",
                borderRadius: 8,
                border: "2px dashed #39FF14",
                pointerEvents: "none",
              }}
            >
              <span style={{ color: "#39FF14", fontSize: "0.75rem", fontWeight: 700 }}>
                Drop to replace
              </span>
            </div>
          )}
          {allowUpload && (
            <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFileChange} />
          )}
        </div>
      </div>
    );
  }

  if (apiLoading && !allowUpload) {
    return (
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div
          style={{
            width: LOGO_W,
            height: LOGO_H,
            maxWidth: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              border: "3px solid rgba(57,255,20,0.2)",
              borderTopColor: "#39FF14",
              animation: "spin 0.8s linear infinite",
            }}
          />
        </div>
      </div>
    );
  }

  if (!allowUpload) {
    return <div style={{ height: LOGO_H, width: LOGO_W, maxWidth: "100%", margin: "0 auto" }} />;
  }

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        style={{
          width: LOGO_W,
          height: LOGO_H,
          maxWidth: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          borderRadius: 12,
          border: dragging ? "2px dashed #39FF14" : "2px dashed rgba(57,255,20,0.35)",
          background: dragging ? "rgba(57,255,20,0.08)" : "rgba(57,255,20,0.03)",
          cursor: uploading ? "wait" : "pointer",
          opacity: uploading ? 0.6 : 1,
          transition: "border-color 0.15s, background 0.15s, opacity 0.2s",
          userSelect: "none",
        }}
        title="Drag & drop or click to upload logo"
      >
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke={dragging ? "#39FF14" : "rgba(57,255,20,0.5)"}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, transition: "stroke 0.15s" }}
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
        <span style={{ color: dragging ? "#39FF14" : "rgba(57,255,20,0.5)", fontSize: "0.7rem", fontWeight: 600, textAlign: "center", lineHeight: 1.4, transition: "color 0.15s" }}>
          {uploading ? "Uploading…" : dragging ? "Drop image here" : "Drop logo here\nor click to browse"}
        </span>
        <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFileChange} />
      </div>
    </div>
  );
}
