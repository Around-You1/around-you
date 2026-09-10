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
        elif s == "@@ORGANOGRAM@@":
            try:
                from svglib.svglib import svg2rlg
                here = os.path.dirname(os.path.abspath(__file__))
                d = svg2rlg(os.path.join(here, "pricing-organogram.svg"))
                avail = A4[0] - 36 * mm
                sc = avail / d.width
                d.width *= sc
                d.height *= sc
                d.scale(sc, sc)
                d.hAlign = "CENTER"
                flow.append(Spacer(1, 4)); flow.append(d); flow.append(Spacer(1, 6))
            except Exception as e:
                flow.append(Paragraph("[pricing organogram — see app]", body))
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

## Your commission — always be up-selling

You earn **25% of every sale you make yourself — every month the partner stays active**. If you're a **Team Leader**, you also earn **10% of every sale made by each rep in your downline**, on top of your own 25%.

Either way, the bigger the plan, the bigger (and more repeatable) your income, so always aim **up**:

- Go for **Both** (guest + local) rather than a single audience.
- Go for **Tier 2** (full profile) rather than Tier 1.
- Add **Bookings** where the partner takes reservations, or **Pre-Orders** for a restaurant doing takeaway/delivery (Pre-Orders also opens Tier 2).

A partner on **Both + Tier 2** with **Bookings or Pre-Orders** is worth far more to you than a bare listing — and gets you to your rep targets much quicker.

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

@@ORGANOGRAM@@

How to explain it to a partner: *R200 gets you listed with the basics per user. R300 gives the full profile with your address and directions per user. R400 gives the full profile to both holiday guests and locals.*

---

## 3. Bookings (if you ticked Booking Partner)

- The **Tier / Guest-Local-Both** section disappears — don't look for it.
- Base fee is **R300/month**, plus a per-booking charge:
- **Restaurants:** R10 per cover (per seat booked).
- **Services:** 10% per service (of the items booked).
- **Attractions:** 10% per person.
- You list **Bookable Items**. Restaurant = tables — the standard covers (Table for 1 = R10, Table for 2 = R20, …) are pre-set by Around You and are **fixed on the app**: you can't change a table price or remove a table (only head office can, from the Admin Dashboard). Service / Attraction = the products/experiences a guest can book — each with a **name, price, and duration (minutes)** that you enter.

How to explain it: *You pay R300 a month, and only a small amount each time someone actually books through the app — so it scales with real bookings.*

---

## 4. Pre-Orders (Restaurants only)

- Only relevant if the restaurant does **Takeaway or Delivery**.
- **Choosing Pre-Orders automatically moves the restaurant to Tier 2** — the full-information fields open up. Pre-Orders and Bookings are **separate, mutually-exclusive choices**: turning on Pre-Orders does **not** make the restaurant a Booking partner. A restaurant is either a Booking partner **or** a Pre-Orders (Tier 2) restaurant — choosing one means the other is ignored, and nothing changes on the accounting side because of the second choice.
- The restaurant pays a flat **R300/month** base, plus **5% of every pre-order** taken through the app. Every pre-order is logged — **what was ordered, when, and the amount** — so the 5% can be billed each month, even though the restaurant can change its menu daily.
- List each pre-order item: **name, description, price, and lead time in minutes** (how long the kitchen needs — 30 min, 45 min, etc.; set it honestly, per dish).
- **Collection / Delivery** — the restaurant sets whether it offers **Takeaway (collection)** and/or **Delivery**. At checkout the guest can only pick an option the restaurant actually offers, then chooses a **preferred date and time**.
- The order is **emailed to the restaurant's Bookings email**. The restaurant confirms with the customer and takes payment their side; the 5% is Around You's commission, billed monthly.

How to explain it: *List the meals people can order ahead and how long each takes. Offering pre-orders opens your full Tier 2 profile, and we take 5% of each pre-order — you get an email for every order with the customer's chosen collection/delivery date and time, then you confirm and take payment your side.*

---

## 5. Things every form needs (and the small gotchas)

- **Rep Code** — must be your rep code so the partner (and commission) is linked to you. On the online form it pre-fills to Rep00000001 (the free/internal code); a real rep must replace it with their own. Leaving Rep00000001 means the partner is treated as free.
- **GPS / location (Latitude & Longitude)** — capture this while standing at the venue. On the onboarding app, tap "Use my current location" just below the Latitude/Longitude fields: allow location access when your phone asks, and the two coordinates fill in automatically from the phone's GPS. Do this outside or near the entrance for the best accuracy, and you can still hand-edit the numbers if needed. The partner doesn't need to know these. (Onboarding remotely rather than on site? Read the coordinates off Google Maps and type them in.)
- **Images** — the onboarding app has an **Images** field (up to 10 photos) that you upload while onboarding. **Logo & menu PDF** aren't on the form — arrange those with head office by email. The rep app is for **new onboarding only**; to add or change images afterwards, the **partner does it themselves using their Edit Code**.
- **Discounts** — there are two separate discount options: a Guest discount and a Local discount. Fill in only the audience(s) they're offering to depending who the Partner wishes to target. Each has an optional code.
- **Charity** — pick one group (Adults / Children / Animals) and one focus (Health / Homes / Food) — e.g. Children – Food. Around You will tally up at the end of each month and a percentage of the total income will go to a charity we deem fit according to the selection.
- **Payment methods** — tick everything they accept.
- **Accessibility & child-friendly** — tick what applies.
- **Signature & T&Cs** — the partner must sign and confirm the info is correct at the bottom.

---

## 6. Per-category checklists

**Office Use (top of every form).** At the top of each category form in the onboarding app there is an **Office Use** section that must be completed — in particular **who the invoice is directed to and the email address it will be sent to**. This is **highly sensitive and must be accurate**: it decides who gets billed and where the invoice lands.

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
3. If Display: Shown to + Tier. If Booking: Bookable items (name / price / minutes), 10% per service.
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
