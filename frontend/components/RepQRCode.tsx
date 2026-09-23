import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import {
  downloadQrCardA6,
  printQrCardA6,
  renderQrCardDataUrl,
  type QrCardOptions,
} from "../lib/qrCard";

interface RepQRCodeProps {
  // The heading shown above the QR (e.g. the rep's code). Kept as a prop so the
  // same card can be reused for other rep campaigns.
  title?: string;
  // The URL the QR encodes. Defaults to the generic Rep Sign In recruitment
  // link; pass a rep-specific /apply?rep=<code> link for a personal marketing QR.
  applyUrl?: string;
  // The caption shown under the QR.
  description?: string;
}

// RepQRCode shares the Around You card layout (logo left, green title over a
// neon-green QR, caption below) and downloads / prints at A6 size.
export default function RepQRCode({
  title = "Become an Around You Rep",
  applyUrl = "https://aroundyou.co.za/rep-login",
  description = "Scan this QR code, click “New Rep Application”, tick the box to accept the Rep Responsibility & Payment Terms, then click “I Agree & Continue”. Complete all of the fields, then click “Submit Application”.",
}: RepQRCodeProps) {
  const card: QrCardOptions = {
    title,
    description,
    data: applyUrl,
    sparkle: true,
  };

  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    renderQrCardDataUrl(card)
      .then((url) => {
        if (alive) setPreview(url);
      })
      .catch(() => {
        if (alive) setPreview(null);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, applyUrl, description]);

  const fileName = `${(title || "Around-You-Rep").replace(/\s+/g, "-")}-QR-A6.png`;

  const handleDownload = async () => {
    setBusy(true);
    try {
      await downloadQrCardA6(card, fileName);
    } finally {
      setBusy(false);
    }
  };

  const handlePrint = async () => {
    setBusy(true);
    try {
      await printQrCardA6(card);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="flex flex-col items-center gap-3 p-4 rounded-lg border"
      style={{ background: "#0a0a0a", borderColor: "rgba(57,255,20,0.3)" }}
    >
      {/* WYSIWYG preview of the exact A6 card that Download / Print produce. */}
      <div
        className="w-full rounded-lg overflow-hidden"
        style={{ border: "2px solid #39FF14", background: "#000", aspectRatio: "1748 / 1240" }}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={`QR card for ${title}`} className="block w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ color: "#39FF14", fontSize: 12 }}>
            Generating card…
          </div>
        )}
      </div>

      <p className="text-[11px] text-center" style={{ color: "#888" }}>
        Downloads &amp; prints at A6 size (148 × 105 mm).
      </p>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={busy || !preview}
          className="h-8 text-xs gap-1"
          style={{ borderColor: "rgba(57,255,20,0.4)", color: "#39FF14", background: "transparent" }}
        >
          <Download className="w-3 h-3" />
          Download A6
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handlePrint}
          disabled={busy || !preview}
          className="h-8 text-xs gap-1"
          style={{ borderColor: "rgba(57,255,20,0.4)", color: "#39FF14", background: "transparent" }}
        >
          <Printer className="w-3 h-3" />
          Print A6
        </Button>
      </div>
    </div>
  );
}
