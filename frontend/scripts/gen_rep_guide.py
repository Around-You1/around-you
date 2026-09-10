#!/usr/bin/env python3
"""Generate the rep guide PDF (public/onboarding/rep-guide.pdf) from the
embedded Markdown below. Lightweight Markdown subset: #/##/### headings, ---
rules, - bullets, 1. numbered items, > quotes, | tables |, **bold**, `code`.
Run:  python3 scripts/gen_rep_guide.py
"""
import os, re, html
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, HRFlowable,
                                Table, TableStyle, ListFlowable, ListItem)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

GREEN = colors.HexColor("#159a53")
DARK = colors.HexColor("#1a1f2e")
GREY = colors.HexColor("#555555")

ss = getSampleStyleSheet()
title = ParagraphStyle("t", parent=ss["Title"], textColor=GREEN, fontSize=20, spaceAfter=6)
h2 = ParagraphStyle("h2", parent=ss["Heading2"], textColor=GREEN, fontSize=14, spaceBefore=12, spaceAfter=4)
h3 = ParagraphStyle("h3", parent=ss["Heading3"], textColor=DARK, fontSize=12, spaceBefore=8, spaceAfter=2)
body = ParagraphStyle("b", parent=ss["BodyText"], textColor=DARK, fontSize=10, leading=14, spaceAfter=4)
quote = ParagraphStyle("q", parent=body, textColor=GREY, leftIndent=10, fontName="Helvetica-Oblique",
                       borderColor=GREEN, spaceBefore=4, spaceAfter=6)
cell = ParagraphStyle("c", parent=body, fontSize=9, spaceAfter=0)


def inline(s):
    s = html.escape(s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)
    s = re.sub(r"`(.+?)`", r'<font face="Courier">\1</font>', s)
    return s


def build(md, out):
    flow = []
    lines = md.split("\n")
    i = 0
    while i < len(lines):
        ln = lines[i]
        s = ln.strip()
        if s == "":
            i += 1
            continue
        if s.startswith("# "):
            flow.append(Paragraph(inline(s[2:]), title))
        elif s.startswith("## "):
            flow.append(Paragraph(inline(s[3:]), h2))
        elif s.startswith("### "):
            flow.append(Paragraph(inline(s[4:]), h3))
        elif s == "---":
            flow.append(Spacer(1, 4)); flow.append(HRFlowable(width="100%", color=GREEN, thickness=0.6)); flow.append(Spacer(1, 4))
        elif s.startswith(">"):
            flow.append(Paragraph(inline(s.lstrip("> ").strip()), quote))
        elif s.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not re.match(r"^-{2,}$", cells[0].replace(" ", "").replace(":", "") or "x"):
                    if not all(re.match(r"^:?-+:?$", c.replace(" ", "")) for c in cells):
                        rows.append([Paragraph(inline(c), cell) for c in cells])
                i += 1
            if rows:
                t = Table(rows, hAlign="LEFT")
                t.setStyle(TableStyle([
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#dddddd")),
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eafaf0")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]))
                flow.append(t); flow.append(Spacer(1, 6))
            continue
        elif re.match(r"^[-*] ", s):
            items = []
            while i < len(lines) and re.match(r"^\s*[-*] ", lines[i]):
                items.append(ListItem(Paragraph(inline(re.sub(r"^\s*[-*] ", "", lines[i])), body), leftIndent=12))
                i += 1
            flow.append(ListFlowable(items, bulletType="bullet", start="•", leftIndent=14))
            continue
        elif re.match(r"^\d+\. ", s):
            items = []
            while i < len(lines) and re.match(r"^\s*\d+\. ", lines[i]):
                items.append(ListItem(Paragraph(inline(re.sub(r"^\s*\d+\. ", "", lines[i])), body), leftIndent=12))
                i += 1
            flow.append(ListFlowable(items, bulletType="1", leftIndent=16))
            continue
        else:
            flow.append(Paragraph(inline(s), body))
        i += 1

    doc = SimpleDocTemplate(out, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                            topMargin=16 * mm, bottomMargin=16 * mm, title="Around You — Rep Guide")
    doc.build(flow)
    print("wrote", out)


MD = r"""
# Around You — Rep Guide: Completing the Onboarding Forms

A plain-English walkthrough of the onboarding forms for reps. Read the first two sections once — they explain the choices that confuse everyone. Then use the per-category checklists.

---

## 1. The single most important choice: Display partner vs Booking partner

Every partner is **one of two things**. Decide this first, because it changes the rest of the form.

**A. Display partner (the normal one).** The partner pays a flat monthly fee to be *listed* so guests/locals can find them, see their info, and get directions. You then choose **who sees them** (Guest / Local / Both) and a **Tier** (how much info shows). Use this for most partners.

**B. Booking partner.** The partner wants guests to actually **book or reserve** through the app (a restaurant table, a spa slot, an activity). Turning this on **removes the Tier and Guest/Local/Both choices** — a Booking partner is automatically shown to **both** guests and locals. They pay the base monthly fee **plus** a small per-booking charge.

> Rule of thumb: "Do they just want to be found?" then Display partner. "Do they want people to book/reserve?" then Booking partner.

Pre-Orders (restaurants) are separate again — see section 4.

---

## 2. Guest / Local / Both — and how it sets the Tier and price

This only applies to **Display partners** (not Booking partners).

**Step 1 — Shown to (who sees the listing):**

- **Guest only** — only holiday guests staying at an accommodation see it.
- **Local only** — only signed-in locals in the area see it.
- **Both** — everyone sees it.

**Step 2 — Tier (how much detail shows):**

- **Tier 1 — R200/month — Partial Information**: a basic listing (name, category, contact, the essentials).
- **Tier 2 — R300/month — Full Information**: the complete profile — physical address, one-tap directions, full detail, all the extras.

**The catch that trips people up:**

- If Shown to is **Guest only** or **Local only**, they may pick **Tier 1 (R200)** or **Tier 2 (R300)**.
- If Shown to is **Both**, it is **always Tier 2**, and the price is **R400/month**. You cannot pick Tier 1 with Both.

| Shown to | Tier 1 (Partial) | Tier 2 (Full) |
| --- | --- | --- |
| Guest only | R200 | R300 |
| Local only | R200 | R300 |
| Both | not allowed | R400 |

How to explain it to a partner: *R200 gets you listed with the basics for one audience. R300 gives the full profile with your address and directions for one audience. R400 gives the full profile to both holiday guests and locals.*

---

## 3. Bookings (if you ticked Booking Partner)

- The **Tier / Guest-Local-Both** section disappears — don't look for it.
- Base fee is **R200/month**, plus a per-booking charge:
- **Restaurants:** R10 per cover (per seat booked).
- **Services:** 10% per order (of the items booked).
- **Attractions:** 10% per person.
- You list **Bookable Items**. Restaurant = tables (Table for 1 = R10, Table for 2 = R20 … defaults are pre-filled; only change a price if theirs differs). Service / Attraction = the products/experiences a guest can book — each with a name, price, and duration (minutes).

How to explain it: *You pay R200 a month, and only a small amount each time someone actually books through the app — so it scales with real bookings.*

---

## 4. Pre-Orders (Restaurants only — separate from everything above)

- Only relevant if the restaurant does **Takeaway or Delivery**.
- It is **independent** of Tier and Bookings — a Tier 1 restaurant can still offer pre-orders.
- List each pre-order item: **name, description, price, and lead time in minutes** (how long the kitchen needs — 30 min, 45 min, etc.; this varies per dish, so set it honestly).
- The guest chooses **Collection or Delivery** and a **preferred time** at checkout — but the app only offers the options the restaurant actually supports (tick Takeaway and/or Delivery correctly).
- A pre-order is **emailed to the restaurant's Bookings email**; no money moves in the app — the restaurant confirms and arranges payment.

How to explain it: *List the meals people can order ahead. Tell us how long each takes to prepare. When someone orders, you get an email with the order and their chosen collection/delivery time — you then confirm and take payment your side.*

---

## 5. Things every form needs (and the small gotchas)

- **Rep Code** — must be your rep code so the partner (and commission) is linked to you. On the online form it pre-fills to Rep00000001 (the free/internal code); a real rep must replace it with their own. Leaving Rep00000001 means the partner is treated as free.
- **GPS / location** — the rep captures this on site; the partner doesn't need to know it.
- **Images / logo / menu PDF** — not on the form; arranged with the rep by email.
- **Discounts** — there are two separate ones: a Guest discount and a Local discount. Fill in only the audience(s) they're offering to. Each has an optional code.
- **Charity** — pick one group (Adults / Children / Animals) and one focus (Health / Homes / Food) — e.g. Children – Food.
- **Payment methods** — tick everything they accept.
- **Accessibility & child-friendly** — tick what applies.
- **Signature & T&Cs** — the partner must sign and confirm the info is correct at the bottom.

---

## 6. Per-category checklists

### Restaurant

1. Business & company details, location.
2. Display or Booking partner? (section 1)
3. If Display: Shown to + Tier (section 2). If Booking: Bookable tables (section 3).
4. Cuisine type(s), Restaurant type, Atmosphere, Features, Dietary options — all multi-select, tick all that apply.
5. Description, menu link, service options (Dine-in / Takeaway / Delivery), Wi-Fi.
6. Pre-Orders — only if Takeaway/Delivery (section 4).
7. Guest &/or Local discounts, payments, socials, accessibility, charity, signature.

### Service

1. Business & company details, location.
2. Display or Booking partner?
3. If Display: Shown to + Tier. If Booking: Bookable items (name / price / minutes), 10% per order.
4. Service category(ies) — multi-select from the groups.
5. Good-to-know: safety info, age restrictions, fitness level, best time of day, what to bring.
6. Discounts, payments, socials, accessibility, charity, signature.

### Attraction

1. Business & company details, location.
2. Display or Booking partner?
3. If Display: Shown to + Tier. If Booking: Bookable items (name / price / minutes), 10% per person.
4. Attraction category(ies) — multi-select.
5. Good-to-know: safety, age, fitness, best time, what to bring, trail difficulty, wildlife/tide/parking/photography notes.
6. Discounts, payments, socials, accessibility, charity, signature.

### Accommodation

1. Business & company details, location.
2. Shown to + Tier (accommodations are Display partners).
3. Number of units/rooms (this sets the monthly price), contact, description.
4. Check-in / check-out instructions, amenities, house guidelines, facilities, Wi-Fi.
5. Emergency contacts — police, ambulance, fire, nearest hospital (number + address), doctor(s), vet(s), NSRI/sea rescue, snake catcher, community watch, local security. These power the guest emergency-directions buttons, so get as many as possible.
6. Accessibility & family, charity, signature.

### Real Estate & Rentals

1. Agency details — name, description, address, province, postal, contact, email, company reg/VAT. (Attach logo + photos by email.)
2. Agent details (per agent page) — full name, contact, email, short bio; agency name if a standalone agent. (Attach the agent's photo.)
3. Property listing (per property) — one set per property: title, type (House/Apartment/Plot), For Sale or To Rent, price, bedrooms/bathrooms/garages, plot & house size, features, description.

---

Keep this handy while filling in a form, and use sections 1–4 to explain the money side to a partner — that's where the questions always come from.
"""

if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(here, "..", "public", "onboarding", "rep-guide.pdf")
    build(MD, os.path.abspath(out))
