import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import {
  downloadQrCard,
  printQrCard,
  renderQrCardDataUrl,
  type QrCardOptions,
} from "../lib/qrCard";

interface ProfileQRCodeProps {
  profileName: string;
  profileCode: string;
  entityType: "accommodation" | "restaurant" | "service" | "attraction";
}

export default function ProfileQRCode({ profileName, profileCode, entityType }: ProfileQRCodeProps) {
  const loginUrl =
    entityType === "accommodation"
      ? `https://aroundyou.co.za/?code=${encodeURIComponent(profileCode)}`
      : `https://aroundyou.co.za/?code=${encodeURIComponent(profileCode)}&role=partner`;

  const description =
    entityType === "accommodation"
      ? "Scan this QR code, then click “Log In” and then click “Sign In” to automatically log in to be able to see all that the Guesthouse has to offer. You will also be able to view Restaurants/Takeaways, Business/Services and Attractions/Activities in and ‘Around You’ up to 150 kilometers."
      : "Scan this QR code, then click “Log In” and then click “Sign In” to automatically log in to be able to see all that this business has to offer.";

  const card: QrCardOptions = {
    title: profileName,
    description,
    data: loginUrl,
    sparkle: entityType !== "accommodation",
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
  }, [loginUrl, profileName, entityType]);

  const fileName = `${(profileName || "around-you").replace(/\s+/g, "-")}-QR-A5.png`;

  const handleDownload = async () => {
    setBusy(true);
    try {
      await downloadQrCard(card, fileName);
    } finally {
      setBusy(false);
    }
  };

  const handlePrint = async () => {
    setBusy(true);
    try {
      await printQrCard(card);
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
        style={{ border: "2px solid #39FF14", background: "#000", aspectRatio: "2480 / 1748" }}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={`QR card for ${profileName}`} className="block w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ color: "#39FF14", fontSize: 12 }}>
            Generating card…
          </div>
        )}
      </div>

      <p className="text-[11px] text-center" style={{ color: "#888" }}>
        Downloads &amp; prints at A5 size (210 × 148 mm).
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
          Download A5
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
          Print A5
        </Button>
      </div>
    </div>
  );
}
