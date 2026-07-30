import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";

interface ProfileQRCodeProps {
  profileName: string;
  profileCode: string;
  entityType: "accommodation" | "restaurant" | "service" | "attraction";
}

export default function ProfileQRCode({ profileName, profileCode, entityType }: ProfileQRCodeProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const loginUrl =
    entityType === "accommodation"
      ? `https://aroundyou.co.za/?code=${encodeURIComponent(profileCode)}`
      : `https://aroundyou.co.za/?code=${encodeURIComponent(profileCode)}&role=partner`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(loginUrl)}&bgcolor=000000&color=39FF14&margin=10`;

  const description =
    entityType === "accommodation"
      ? "Scan this QR code to automatically log in so as to be able to see all that the Guesthouse has to offer. You will also be able to view Restaurants, Services and Attractions in and 'Around You' up to 150 kilometers."
      : "Use this QR code for social media marketing so that anyone can view all that your establishment has to offer.";

  const handleDownload = async () => {
    const qrDownloadUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(loginUrl)}&bgcolor=000000&color=39FF14&margin=10`;

    // Compose the same title + QR + description card the Print button
    // produces, onto a canvas, so Download gives the full page rather than
    // just the bare QR square underneath it.
    const qrImage = new Image();
    qrImage.crossOrigin = "anonymous";

    await new Promise<void>((resolve, reject) => {
      qrImage.onload = () => resolve();
      qrImage.onerror = () => reject(new Error("Failed to load QR image"));
      qrImage.src = qrDownloadUrl;
    });

    const width = 640;
    const height = 900;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background + border, matching the printed page's look.
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#39FF14";
    ctx.lineWidth = 4;
    ctx.strokeRect(12, 12, width - 24, height - 24);

    // Title.
    ctx.fillStyle = "#39FF14";
    ctx.font = "bold 32px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(profileName, width / 2, 70);

    // QR image, centered.
    const qrSize = 460;
    const qrX = (width - qrSize) / 2;
    const qrY = 110;
    ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

    // Access code, monospace, right under the QR.
    ctx.fillStyle = "#39FF14";
    ctx.font = "18px monospace";
    ctx.fillText(profileCode, width / 2, qrY + qrSize + 40);

    // Description, word-wrapped.
    ctx.fillStyle = "#aaaaaa";
    ctx.font = "16px system-ui, sans-serif";
    const maxLineWidth = width - 100;
    const words = description.split(" ");
    let line = "";
    let y = qrY + qrSize + 80;
    const lineHeight = 24;
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      if (ctx.measureText(testLine).width > maxLineWidth && line) {
        ctx.fillText(line, width / 2, y);
        line = word;
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    if (line) {
      ctx.fillText(line, width / 2, y);
    }

    canvas.toBlob((blob) => {
      if (!blob) return;
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${profileName.replace(/\s+/g, "-")}-QR-Code.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    }, "image/png");
  };

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const printUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(loginUrl)}&bgcolor=000000&color=39FF14&margin=20`;
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code – ${profileName}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              background: #000;
              color: #39FF14;
              font-family: system-ui, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              padding: 40px 24px;
              text-align: center;
            }
            h1 { font-size: 22px; font-weight: 700; margin-bottom: 24px; color: #39FF14; }
            img { border: 2px solid #39FF14; border-radius: 8px; max-width: 300px; }
            .code { font-family: monospace; font-size: 18px; letter-spacing: 0.15em; margin-top: 20px; color: #39FF14; }
            p { margin-top: 16px; font-size: 13px; color: #aaa; max-width: 340px; line-height: 1.5; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <h1>${profileName}</h1>
          <img src="${printUrl}" alt="QR Code" onload="window.print()" />
          <div class="code">${profileCode}</div>
          <p>${description}</p>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div
      ref={printRef}
      className="flex flex-col items-center gap-3 p-4 rounded-lg border"
      style={{
        background: "#0a0a0a",
        borderColor: "rgba(57,255,20,0.3)",
      }}
    >
      <p
        className="text-sm font-bold text-center"
        style={{ color: "#39FF14" }}
      >
        {profileName}
      </p>

      <div
        className="p-2 rounded-lg"
        style={{ background: "#000", border: "2px solid #39FF14" }}
      >
        <img
          src={qrUrl}
          alt={`QR Code for ${profileName}`}
          width={180}
          height={180}
          className="block"
          style={{ imageRendering: "pixelated" }}
        />
      </div>

      <p
        className="text-xs text-center max-w-[260px] leading-relaxed"
        style={{ color: "#aaa" }}
      >
        {description}
      </p>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleDownload}
          className="h-8 text-xs gap-1"
          style={{ borderColor: "rgba(57,255,20,0.4)", color: "#39FF14", background: "transparent" }}
        >
          <Download className="w-3 h-3" />
          Download
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handlePrint}
          className="h-8 text-xs gap-1"
          style={{ borderColor: "rgba(57,255,20,0.4)", color: "#39FF14", background: "transparent" }}
        >
          <Printer className="w-3 h-3" />
          Print
        </Button>
      </div>
    </div>
  );
}
