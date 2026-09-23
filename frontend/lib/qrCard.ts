// Shared renderer for the "Around You" QR cards (Accommodation, Partner, Rep).
//
// Every card is the same landscape layout — the full Around You logo on the
// left, a green title over a large neon-green QR on the right, and a caption
// across the bottom — drawn onto a canvas sized to A6 landscape at 300 DPI so
// the Download and Print buttons both produce a print-ready A6 card.
//
// A6 = 105 × 148 mm. Landscape → 148 × 105 mm. At 300 DPI that is
// 1748 × 1240 px.

export const A6_W = 1748; // 148 mm @ 300 DPI
export const A6_H = 1240; // 105 mm @ 300 DPI

const LOGO_SRC = "/around-you-logo.png";
const LUMO = "#39FF14";

export interface QrCardOptions {
  title: string;
  description: string;
  /** The URL the QR should encode. */
  data: string;
  /** Show the small green sparkle under the caption (Partner / Rep cards). */
  sparkle?: boolean;
}

function loadImage(src: string, crossOrigin?: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function qrImageUrl(data: string): string {
  // High-res so the A6 print stays crisp. qrserver caps at 1000×1000.
  return `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(
    data
  )}&bgcolor=000000&color=39FF14&margin=8`;
}

/**
 * Draw the card onto a fresh canvas and return it. Loads the logo (same-origin)
 * and the QR (cross-origin, so the canvas stays untainted and can be exported).
 */
export async function renderQrCardCanvas(
  opts: QrCardOptions
): Promise<HTMLCanvasElement> {
  const [logoImg, qrImg] = await Promise.all([
    loadImage(LOGO_SRC),
    loadImage(qrImageUrl(opts.data), true),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = A6_W;
  canvas.height = A6_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  const W = A6_W;
  const H = A6_H;

  // Background.
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, H);

  // Logo (left), preserve aspect ratio, fit inside a box.
  const boxW = 680;
  const boxH = 760;
  const boxX = 70;
  const boxY = 150;
  const ar = logoImg.width / logoImg.height;
  let lw = boxW;
  let lh = lw / ar;
  if (lh > boxH) {
    lh = boxH;
    lw = lh * ar;
  }
  ctx.drawImage(logoImg, boxX + (boxW - lw) / 2, boxY + (boxH - lh) / 2, lw, lh);

  // Right column geometry.
  const rcx = 1265; // right-column centre x
  const qrSize = 760;
  const qrX = rcx - qrSize / 2;
  const qrY = 250;

  // Title (green, bold) — auto-fit to the right column width.
  ctx.fillStyle = LUMO;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  let fs = 64;
  // Centred on rcx; keep the widest line inside the card (right edge is the
  // tighter bound: rcx + maxTitleW/2 must stay < W - margin).
  const maxTitleW = 860;
  const titleFont = (s: number) =>
    `700 ${s}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  do {
    ctx.font = titleFont(fs);
    if (ctx.measureText(opts.title).width <= maxTitleW) break;
    fs -= 2;
  } while (fs > 22);
  ctx.font = titleFont(fs);
  ctx.fillText(opts.title, rcx, qrY - 40);

  // QR.
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  // Description (white, centred, word-wrapped) across the bottom.
  ctx.fillStyle = "#ffffff";
  ctx.font = `400 32px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  const maxLine = W - 200;
  const words = opts.description.split(" ");
  let line = "";
  const lines: string[] = [];
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxLine && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  const lineHeight = 44;
  let ty = 1055;
  for (const ln of lines) {
    ctx.fillText(ln, W / 2, ty);
    ty += lineHeight;
  }
  if (opts.sparkle) {
    ctx.fillStyle = LUMO;
    ctx.font = `700 30px system-ui, sans-serif`;
    ctx.fillText("✦", W / 2, ty + 8);
  }

  return canvas;
}

/** Render the card and return a PNG data URL (used for the on-screen preview). */
export async function renderQrCardDataUrl(opts: QrCardOptions): Promise<string> {
  const canvas = await renderQrCardCanvas(opts);
  return canvas.toDataURL("image/png");
}

/** Render the card and trigger a PNG download at A6 size. */
export async function downloadQrCardA6(
  opts: QrCardOptions,
  fileName: string
): Promise<void> {
  const canvas = await renderQrCardCanvas(opts);
  await new Promise<void>((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve();
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      resolve();
    }, "image/png");
  });
}

/** Render the card and open the browser print dialog, sized to A6 landscape. */
export async function printQrCardA6(opts: QrCardOptions): Promise<void> {
  const dataUrl = await renderQrCardDataUrl(opts);
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Around You QR — ${opts.title}</title>
        <style>
          @page { size: A6 landscape; margin: 0; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html, body { background: #000; }
          img { display: block; width: 100vw; height: 100vh; object-fit: contain; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <img src="${dataUrl}" alt="QR card" onload="window.focus(); window.print();" />
      </body>
    </html>
  `);
  win.document.close();
}
