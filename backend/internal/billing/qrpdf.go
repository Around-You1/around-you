package billing

import (
	"bytes"
	"context"
	_ "embed"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	"image/png"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"backend_encore/internal/appdb"
)

// qrDecalBG is the branded A5 decal background (phone-in-hand on black felt with
// the green border and instruction text baked in). The partner's profile QR and
// business name are composited into the open area on the left before the card is
// emailed.
//
//go:embed qr-decal-bg.jpg
var qrDecalBG []byte

// nameAtlasPNG is a pre-rendered Carlito-Bold glyph atlas (printable ASCII
// 32..126) used to draw the partner's business name above the QR without pulling
// in a font-rendering dependency. White glyphs on transparent; tinted green at
// composite time. Built from Carlito-Bold at 84px — see nameAtlas* constants.
//
//go:embed name_atlas.png
var nameAtlasPNG []byte

// Glyph atlas metrics (must match the generator that produced name_atlas.png).
const (
	atlasFirst = 32  // first ASCII code in the atlas
	atlasCount = 95  // chars 32..126
	atlasCellW = 86  // fixed cell width per glyph in the atlas
	atlasCellH = 103 // atlas (and line) height
)

// nameAdvances holds the pen advance in px for each atlas glyph (index = rune -
// atlasFirst), so proportional spacing matches the source font.
var nameAdvances = [atlasCount]int{
	19, 27, 37, 42, 43, 61, 59, 20, 26, 26, 42, 42,
	22, 26, 22, 36, 43, 43, 43, 43, 43, 43, 43, 43,
	43, 43, 23, 23, 42, 42, 42, 39, 75, 51, 47, 44,
	53, 41, 39, 54, 53, 22, 28, 46, 36, 73, 55, 57,
	45, 58, 47, 40, 42, 55, 50, 76, 46, 44, 40, 27,
	36, 27, 42, 42, 25, 41, 45, 35, 45, 42, 27, 40,
	45, 21, 21, 40, 21, 68, 45, 45, 45, 45, 30, 34,
	29, 45, 40, 63, 39, 40, 33, 29, 40, 29, 42,
}

// Brand lumo green for the QR modules and the partner name.
var decalGreen = color.RGBA{R: 0x39, G: 0xFF, B: 0x14, A: 0xFF}

// QR placement on the 2000x1409 decal background (left-centre open area).
const (
	qrDecalSize = 780
	qrDecalX    = 235
	qrDecalY    = 505
	// Partner name sits centred above the QR, this many px above its top edge.
	nameGapAboveQR = 28
	// Widest the name may be before it is scaled down to fit the open area.
	nameMaxWidth = 1080
)

// buildQRCodePDF composites the partner's green-on-black profile QR and business
// name onto the branded decal background and returns it as a print-ready A5
// landscape PDF. Best-effort: returns ok=false if the partner has no profile
// code or the QR / background can't be fetched/decoded, so the caller can still
// send the email.
func buildQRCodePDF(ctx context.Context, partnerType string, partnerID int64) ([]byte, bool) {
	tbl := partnerTable(partnerType)
	if tbl == "" {
		return nil, false
	}
	var profileRef, name string
	if err := appdb.SQLDB.QueryRowContext(ctx,
		"SELECT COALESCE(profile_reference_code,''), COALESCE(name,'') FROM "+tbl+" WHERE id = $1", partnerID,
	).Scan(&profileRef, &name); err != nil {
		return nil, false
	}
	if strings.TrimSpace(profileRef) == "" {
		return nil, false
	}

	loginURL := profileURL(partnerType, profileRef)
	qrURL := fmt.Sprintf(
		"https://api.qrserver.com/v1/create-qr-code/?size=%dx%d&margin=8&bgcolor=000000&color=39FF14&data=%s",
		qrDecalSize, qrDecalSize, url.QueryEscape(loginURL))

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(qrURL)
	if err != nil {
		return nil, false
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return nil, false
	}
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 5<<20))
	if err != nil {
		return nil, false
	}
	qrImg, _, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return nil, false
	}

	bg, _, err := image.Decode(bytes.NewReader(qrDecalBG))
	if err != nil {
		return nil, false
	}

	canvas := image.NewRGBA(bg.Bounds())
	draw.Draw(canvas, bg.Bounds(), bg, bg.Bounds().Min, draw.Src)

	// QR into the open area.
	dst := image.Rect(qrDecalX, qrDecalY, qrDecalX+qrDecalSize, qrDecalY+qrDecalSize)
	qb := qrImg.Bounds()
	if qb.Dx() == qrDecalSize && qb.Dy() == qrDecalSize {
		draw.Draw(canvas, dst, qrImg, qb.Min, draw.Over)
	} else {
		drawNearestScaled(canvas, dst, qrImg)
	}

	// Partner name in green, centred above the QR.
	if nm := renderNameImage(name); nm != nil {
		nb := nm.Bounds()
		nw, nh := nb.Dx(), nb.Dy()
		cx := qrDecalX + qrDecalSize/2
		if nw > nameMaxWidth {
			scale := float64(nameMaxWidth) / float64(nw)
			dw := nameMaxWidth
			dh := int(float64(nh) * scale)
			nm = scaleRGBANearest(nm, dw, dh)
			nw, nh = dw, dh
		}
		top := qrDecalY - nameGapAboveQR - nh
		if top < 0 {
			top = 0
		}
		r := image.Rect(cx-nw/2, top, cx-nw/2+nw, top+nh)
		draw.Draw(canvas, r, nm, nm.Bounds().Min, draw.Over)
	}

	var jb bytes.Buffer
	if err := jpeg.Encode(&jb, canvas, &jpeg.Options{Quality: 88}); err != nil {
		return nil, false
	}
	return buildFullPageImagePDFJPEG(jb.Bytes(), canvas.Bounds().Dx(), canvas.Bounds().Dy()), true
}

// renderNameImage draws the business name as green glyphs on a transparent
// canvas using the embedded atlas. Returns nil for an empty name or if the
// atlas can't be decoded. Characters outside printable ASCII are skipped.
func renderNameImage(name string) *image.RGBA {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil
	}
	atlas, err := png.Decode(bytes.NewReader(nameAtlasPNG))
	if err != nil {
		return nil
	}
	total := 0
	for _, r := range name {
		idx := int(r) - atlasFirst
		if idx < 0 || idx >= atlasCount {
			continue
		}
		total += nameAdvances[idx]
	}
	if total <= 0 {
		return nil
	}
	img := image.NewRGBA(image.Rect(0, 0, total, atlasCellH))
	green := image.NewUniform(decalGreen)
	pen := 0
	for _, r := range name {
		idx := int(r) - atlasFirst
		if idx < 0 || idx >= atlasCount {
			continue
		}
		// Paint green where the glyph's alpha is set (atlas is the mask).
		draw.DrawMask(img,
			image.Rect(pen, 0, pen+atlasCellW, atlasCellH),
			green, image.Point{},
			atlas, image.Pt(idx*atlasCellW, 0),
			draw.Over)
		pen += nameAdvances[idx]
	}
	return img
}

// scaleRGBANearest returns a dw x dh copy of src using nearest-neighbour
// sampling, preserving alpha (used to shrink an over-long name to fit).
func scaleRGBANearest(src *image.RGBA, dw, dh int) *image.RGBA {
	out := image.NewRGBA(image.Rect(0, 0, dw, dh))
	sb := src.Bounds()
	if dw <= 0 || dh <= 0 || sb.Dx() <= 0 || sb.Dy() <= 0 {
		return out
	}
	for y := 0; y < dh; y++ {
		sy := sb.Min.Y + y*sb.Dy()/dh
		for x := 0; x < dw; x++ {
			sx := sb.Min.X + x*sb.Dx()/dw
			out.Set(x, y, src.At(sx, sy))
		}
	}
	return out
}

// drawNearestScaled paints src into the rectangle r of dst using
// nearest-neighbour sampling — a tiny, dependency-free fallback used only if the
// QR service returns an off-size image.
func drawNearestScaled(dst *image.RGBA, r image.Rectangle, src image.Image) {
	sb := src.Bounds()
	dw, dh := r.Dx(), r.Dy()
	if dw <= 0 || dh <= 0 || sb.Dx() <= 0 || sb.Dy() <= 0 {
		return
	}
	for y := 0; y < dh; y++ {
		sy := sb.Min.Y + y*sb.Dy()/dh
		for x := 0; x < dw; x++ {
			sx := sb.Min.X + x*sb.Dx()/dw
			dst.Set(r.Min.X+x, r.Min.Y+y, src.At(sx, sy))
		}
	}
}

// buildFullPageImagePDFJPEG embeds a JPEG as a single full-bleed A5 landscape
// page (210x148mm), as a minimal, valid, dependency-free PDF.
func buildFullPageImagePDFJPEG(jpegBytes []byte, w, h int) []byte {
	const pageW, pageH = 595.0, 420.0
	content := []byte(fmt.Sprintf("q %.2f 0 0 %.2f 0 0 cm /Im0 Do Q", pageW, pageH))

	objs := []string{
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 420] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>",
	}

	var buf bytes.Buffer
	offsets := make([]int, 6)
	buf.WriteString("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
	for i := 1; i <= 3; i++ {
		offsets[i] = buf.Len()
		fmt.Fprintf(&buf, "%d 0 obj\n%s\nendobj\n", i, objs[i-1])
	}
	offsets[4] = buf.Len()
	fmt.Fprintf(&buf, "4 0 obj\n<< /Length %d >>\nstream\n", len(content))
	buf.Write(content)
	buf.WriteString("\nendstream\nendobj\n")
	offsets[5] = buf.Len()
	fmt.Fprintf(&buf, "5 0 obj\n<< /Type /XObject /Subtype /Image /Width %d /Height %d /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length %d >>\nstream\n", w, h, len(jpegBytes))
	buf.Write(jpegBytes)
	buf.WriteString("\nendstream\nendobj\n")

	xrefAt := buf.Len()
	buf.WriteString("xref\n0 6\n0000000000 65535 f \n")
	for i := 1; i <= 5; i++ {
		fmt.Fprintf(&buf, "%010d 00000 n \n", offsets[i])
	}
	fmt.Fprintf(&buf, "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF", xrefAt)
	return buf.Bytes()
}
