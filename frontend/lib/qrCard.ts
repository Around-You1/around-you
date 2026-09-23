// Shared renderer for the "Around You" QR cards (Accommodation, Partner, Rep).
//
// Every card is the same landscape layout — the full Around You logo on the
// left, a green title over a large neon-green QR on the right, and a caption
// across the bottom — exported at A5 landscape, 300 DPI, with the DPI written
// into the PNG (a pHYs chunk) so PowerPoint / Word insert it at exactly A5
// (210 × 148 mm ≈ 8.27" × 5.83") instead of guessing the physical size.
//
// A5 = 148 × 210 mm. Landscape → 210 × 148 mm. At 300 DPI that is
// 2480 × 1748 px.

const DPI = 300;
export const CARD_W = 2480; // 210 mm @ 300 DPI (A5 landscape width)
export const CARD_H = 1748; // 148 mm @ 300 DPI (A5 landscape height)

// The layout below was tuned on this base canvas; we draw in these base
// coordinates and uniformly scale up to the A5 pixel size, so the QR stays
// perfectly square and nothing is distorted.
const BASE_W = 1748;
const BASE_H = 1240;

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
  // High-res so the A5 print stays crisp. qrserver caps at 1000×1000.
  return `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(
    data
  )}&bgcolor=000000&color=39FF14&margin=8`;
}

// Draw the card in BASE_W × BASE_H coordinates onto the given context.
function drawCard(
  ctx: CanvasRenderingContext2D,
  opts: QrCardOptions,
  logoImg: HTMLImageElement,
  qrImg: HTMLImageElement
) {
  const W = BASE_W;

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
}

/**
 * Render the card onto a fresh canvas at A5 (2480 × 1748) and return it. Loads
 * the logo (same-origin) and the QR (cross-origin, so the canvas stays
 * untainted and can be exported).
 */
export async function renderQrCardCanvas(
  opts: QrCardOptions
): Promise<HTMLCanvasElement> {
  const [logoImg, qrImg] = await Promise.all([
    loadImage(LOGO_SRC),
    loadImage(qrImageUrl(opts.data), true),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  // Full black background (covers the thin side margins left by centring).
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Uniformly scale the tuned base layout up to A5 and centre it horizontally.
  const k = CARD_H / BASE_H;
  const xOffset = (CARD_W - BASE_W * k) / 2;
  ctx.save();
  ctx.setTransform(k, 0, 0, k, xOffset, 0);
  // Re-fill the base area black so the card body is solid.
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, BASE_W, BASE_H);
  drawCard(ctx, opts, logoImg, qrImg);
  ctx.restore();

  return canvas;
}

// --- PNG DPI tagging (pHYs chunk) ---------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Insert a pHYs chunk (physical pixel dimensions) into a PNG so image editors
 * and Office apps place it at the intended DPI / physical size.
 */
async function tagPngDpi(blob: Blob, dpi: number): Promise<Blob> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  // PNG signature (8) + IHDR chunk (length 4 + type 4 + data 13 + crc 4 = 25)
  // → the IHDR chunk ends at byte 33; pHYs must appear before IDAT.
  const insertAt = 33;
  const ppm = Math.round(dpi / 0.0254); // pixels per metre

  const chunk = new Uint8Array(21); // len(4) + type(4) + data(9) + crc(4)
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, 9); // data length
  chunk[4] = 0x70; // 'p'
  chunk[5] = 0x48; // 'H'
  chunk[6] = 0x59; // 'Y'
  chunk[7] = 0x73; // 's'
  dv.setUint32(8, ppm); // x pixels per unit
  dv.setUint32(12, ppm); // y pixels per unit
  chunk[16] = 1; // unit specifier: metre
  const crc = crc32(chunk.subarray(4, 17)); // over type + data
  dv.setUint32(17, crc);

  const out = new Uint8Array(buf.length + chunk.length);
  out.set(buf.subarray(0, insertAt), 0);
  out.set(chunk, insertAt);
  out.set(buf.subarray(insertAt), insertAt + chunk.length);
  return new Blob([out], { type: "image/png" });
}

async function canvasToTaggedBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  const raw = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png")
  );
  if (!raw) return null;
  try {
    return await tagPngDpi(raw, DPI);
  } catch {
    return raw; // fall back to the untagged PNG if tagging fails
  }
}

/** Render the card and return a PNG data URL (used for the on-screen preview). */
export async function renderQrCardDataUrl(opts: QrCardOptions): Promise<string> {
  const canvas = await renderQrCardCanvas(opts);
  return canvas.toDataURL("image/png");
}

/** Render the card and trigger a PNG download at A5 size (300 DPI tagged). */
export async function downloadQrCard(
  opts: QrCardOptions,
  fileName: string
): Promise<void> {
  const canvas = await renderQrCardCanvas(opts);
  const blob = await canvasToTaggedBlob(canvas);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Render the card and open the browser print dialog, sized to A5 landscape. */
export async function printQrCard(opts: QrCardOptions): Promise<void> {
  const dataUrl = await renderQrCardDataUrl(opts);
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Around You QR — ${opts.title}</title>
        <style>
          @page { size: A5 landscape; margin: 0; }
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
