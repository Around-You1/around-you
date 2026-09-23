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
                                Table, TableStyle, ListFlowable, ListItem, PageBreak)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.graphics.shapes import Drawing, Rect, String, Line

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



def _pricing_organogram():
    """Native reportlab rendering of the partner-pricing organogram
    (previously an SVG rendered via svglib). Self-contained: needs only
    reportlab, so it renders anywhere the other PDFs do."""
    H = 380.0
    d = Drawing(820, H)
    def col(c):
        return colors.HexColor(c)
    lines = [
        (410,62,140,100,"#B4B2A9"),(410,62,410,100,"#B4B2A9"),(410,62,680,100,"#B4B2A9"),
        (140,150,140,330,"#AFA9EC"),(410,150,410,176,"#5DCAA5"),(680,150,680,176,"#F0997B"),
    ]
    for x1,y1,x2,y2,c in lines:
        ln = Line(x1, H-y1, x2, H-y2)
        ln.strokeColor = col(c); ln.strokeWidth = 1.5
        d.add(ln)
    rects = [
        (310,18,200,44,"#F1EFE8","#5F5E5A"),
        (30,100,220,50,"#EEEDFE","#534AB7"),(300,100,220,50,"#E1F5EE","#0F6E56"),(570,100,220,50,"#FAECE7","#993C1D"),
        (40,176,200,50,"#EEEDFE","#534AB7"),(40,240,200,50,"#EEEDFE","#534AB7"),(40,304,200,50,"#EEEDFE","#534AB7"),
        (300,176,220,178,"#E1F5EE","#0F6E56"),(570,176,220,178,"#FAECE7","#993C1D"),
    ]
    for x,y,w,h,fill,stroke in rects:
        r = Rect(x, H-(y+h), w, h, rx=6, ry=6)
        r.fillColor = col(fill); r.strokeColor = col(stroke); r.strokeWidth = 1
        d.add(r)
    texts = [
        (410,38,14,"#2C2C2A","Partner pricing"),(410,54,11,"#5F5E5A","all prices per month"),
        (140,122,14,"#26215C","Display partner"),(140,139,11,"#534AB7","listed — by audience + plan"),
        (410,122,14,"#04342C","Booking partner"),(410,139,11,"#0F6E56","reserve in-app"),
        (680,122,14,"#4A1B0C","Pre-orders"),(680,139,11,"#993C1D","restaurants/takeaways only"),
        (140,197,13,"#26215C","Guest only"),(140,215,11,"#534AB7","Basic R200 · Premium R300"),
        (140,261,13,"#26215C","Local only"),(140,279,11,"#534AB7","Basic R200 · Premium R300"),
        (140,325,13,"#26215C","Both"),(140,343,11,"#534AB7","Premium only — R400"),
        (410,200,13,"#04342C","R400 / month base"),(410,226,11,"#0F6E56","Restaurants/Takeaways: +R10/cover"),
        (410,248,11,"#0F6E56","Business/Services: + 10% / service"),(410,270,11,"#0F6E56","Attractions: + 10% / person"),
        (410,300,11,"#0F6E56","shown to Both"),
        (680,200,13,"#4A1B0C","R400 / month + 5%"),(680,226,11,"#993C1D","5% of each pre-order"),
        (680,248,11,"#993C1D","opens Premium (full info)"),(680,270,11,"#993C1D","chosen audience"),
        (680,300,11,"#993C1D","takeaway / delivery only"),
    ]
    for x,y,size,fill,t in texts:
        st = String(x, H-y, t)
        st.textAnchor = "middle"; st.fontName = "Helvetica"; st.fontSize = size
        st.fillColor = col(fill)
        d.add(st)
    return d


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
        elif s == "@@PAGEBREAK@@":
            flow.append(PageBreak())
        elif s == "@@ORGANOGRAM@@":
            d = _pricing_organogram()
            avail = A4[0] - 36 * mm
            sc = avail / d.width
            d.width *= sc
            d.height *= sc
            d.scale(sc, sc)
            d.hAlign = "CENTER"
            flow.append(Spacer(1, 4)); flow.append(d); flow.append(Spacer(1, 6))
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

**A. Display partner (the normal one).** The partner pays a flat monthly fee to be *listed* so guests/locals can find them, see their info, and get directions. You then choose **who sees them** (Guest / Local / Both) and a **Plan** (Basic or Premium — how much info shows). Use this for most partners.

**B. Booking partner.** The partner wants guests to actually **book or reserve** through the app (a restaurant table, a spa slot, an activity). Turning this on **removes the Plan and Guest/Local/Both choices** — a Booking partner is automatically shown to **both** guests and locals. They pay the base monthly fee **plus** a small per-booking charge.

> Rule of thumb: "Do they just want to be found?" then Display partner. "Do they want people to book/reserve?" then Booking partner.

Pre-Orders (restaurants) are separate again — see section 4.

---

## Your commission — always be up-selling

You earn **25% of every sale you make yourself — every month the partner stays active**. If you're a **Team Leader**, you also earn **10% of every sale made by each rep in your downline**, on top of your own 25%.

Either way, the bigger the plan, the bigger (and more repeatable) your income, so always aim **up**:

- Go for **Both** (guest + local) rather than a single audience.
- Go for **Premium** (full profile) rather than Basic.
- Add **Bookings** where the partner takes reservations, or **Pre-Orders** for a restaurant doing takeaway/delivery (Pre-Orders also opens Premium).

A partner on **Both + Premium** with **Bookings or Pre-Orders** is worth far more to you than a bare listing — and gets you to your rep targets much quicker.

---

## 2. Guest / Local / Both — and how it sets the Plan and price

This only applies to **Display partners** (not Booking partners).

**Step 1 — Shown to (who sees the listing):**

- **Guest only** — only holiday guests staying at an accommodation see it.
- **Local only** — only signed-in locals in the area see it.
- **Both** — everyone sees it.

**Step 2 — Plan (Basic or Premium — how much detail shows):**

- **Basic — R200/month — Partial Information**: a basic listing (name, category, contact, the essentials).
- **Premium — R300/month — Full Information**: the complete profile — physical address, one-tap directions, full detail, all the extras.

**The catch that trips people up:**

- If Shown to is **Guest only** or **Local only**, they may pick **Basic (R200)** or **Premium (R300)**.
- If Shown to is **Both**, it is **always Premium**, and the price is **R400/month**. You cannot pick Basic with Both.

@@ORGANOGRAM@@

How to explain it to a partner: *R200 gets you listed with the basics per user. R300 gives the full profile with your address and directions per user. R400 gives the full profile to both holiday guests and locals.*

---

## 3. Bookings (if you ticked Booking Partner)

- The **Plan / Guest-Local-Both** section disappears — don't look for it.
- Base fee is **R400/month**, plus a per-booking charge:
- **Restaurants/Takeaways:** R10 per cover (per seat booked).
- **Business/Services:** 10% per service (of the items booked).
- **Attractions:** 10% per person.
- You list **Bookable Items**. Restaurant = tables — the standard covers (Table for 1 = R10, Table for 2 = R20, …) are pre-set by Around You and are **fixed on the app**: you can't change a table price or remove a table (only head office can, from the Admin Dashboard). Business/Service / Attraction = the products/experiences a guest can book — each with a **name, price, and duration (minutes)** that you enter.

How to explain it: *You pay R400 a month, and only a small amount each time someone actually books through the app — so it scales with real bookings.*

@@PAGEBREAK@@

## 4. Pre-Orders (Restaurants/Takeaways only)

- Only relevant if the restaurant does **Takeaway or Delivery**.
- **Choosing Pre-Orders automatically moves the restaurant to Premium** — the full-information fields open up. Pre-Orders and Bookings are **separate, mutually-exclusive choices**: turning on Pre-Orders does **not** make the restaurant a Booking partner. A restaurant is either a Booking partner **or** a Pre-Orders (Premium) restaurant — choosing one means the other is ignored, and nothing changes on the accounting side because of the second choice.
- The restaurant pays a flat **R400/month** base, plus **5% of every pre-order** taken through the app. Every pre-order is logged — **what was ordered, when, and the amount** — so the 5% can be billed each month, even though the restaurant can change its menu daily.
- List each pre-order item: **name, description, price, and lead time in minutes** (how long the kitchen needs — 30 min, 45 min, etc.; set it honestly, per dish).
- **Collection / Delivery** — the restaurant sets whether it offers **Takeaway (collection)** and/or **Delivery**. At checkout the guest can only pick an option the restaurant actually offers, then chooses a **preferred date and time**.
- The order is **emailed to the restaurant's Bookings email**. The restaurant confirms with the customer and takes payment their side; the 5% is Around You's commission, billed monthly.

How to explain it: *List the meals people can order ahead and how long each takes. Offering pre-orders opens your full Premium profile, and we take 5% of each pre-order — you get an email for every order with the customer's chosen collection/delivery date and time, then you confirm and take payment your side.*

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

### Restaurant/Takeaway

1. Business & company details, location.
2. Display or Booking partner? (section 1)
3. If Display: Shown to + Plan (section 2). If Booking: Bookable tables (section 3).
4. Cuisine type(s), Restaurant/Takeaway type, Atmosphere, Features, Dietary options — all multi-select, tick all that apply.
5. Description, menu link, service options (Dine-in / Takeaway / Delivery), Wi-Fi.
6. Pre-Orders — only if Takeaway/Delivery (section 4).
7. Guest &/or Local discounts, payments, socials, accessibility, charity, signature.

### Business/Service

1. Business & company details, location.
2. Display or Booking partner?
3. If Display: Shown to + Plan. If Booking: Bookable items (name / price / minutes), 10% per service.
4. Business/Service category(ies) — multi-select from the groups.
5. Good-to-know: safety info, age restrictions, fitness level, best time of day, what to bring.
6. Discounts, payments, socials, accessibility, charity, signature.

### Attraction

1. Business & company details, location.
2. Display or Booking partner?
3. If Display: Shown to + Plan. If Booking: Bookable items (name / price / minutes), 10% per person.
4. Attraction category(ies) — multi-select.
5. Good-to-know: safety, age, fitness, best time, what to bring, trail difficulty, wildlife/tide/parking/photography notes.
6. Discounts, payments, socials, accessibility, charity, signature.

### Accommodation

1. Business & company details, location.
2. Shown to + Plan (accommodations are Display partners).
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
