import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Image,
                                HRFlowable, Table, TableStyle, KeepTogether, PageBreak)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
pdfmetrics.registerFont(TTFont("DejaVu","/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("DejaVu-Bold","/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))
pdfmetrics.registerFontFamily("DejaVu", normal="DejaVu", bold="DejaVu-Bold", italic="DejaVu", boldItalic="DejaVu-Bold")

_BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(_BASE, "..", "public", "onboarding")
LOGO = os.path.join(_BASE, "..", "public", "around-you-logo.png")
GREEN = colors.HexColor("#159a53")
DARK = colors.HexColor("#1a1f2e")
GREY = colors.HexColor("#9aa0a6")
LINEGREY = colors.HexColor("#bfc4c9")

styles = getSampleStyleSheet()
for _s in styles.byName.values(): _s.fontName = "DejaVu"
h1 = ParagraphStyle("h1", parent=styles["Title"], textColor=GREEN, fontSize=19, spaceAfter=2, alignment=1, fontName="DejaVu-Bold")
sub = ParagraphStyle("sub", parent=styles["Normal"], fontSize=9.5, textColor=colors.HexColor("#555"), spaceAfter=8, leading=13)
sec = ParagraphStyle("sec", parent=styles["Heading2"], textColor=colors.white, fontSize=12, spaceBefore=2, spaceAfter=2, leading=15, fontName="DejaVu-Bold")
lbl = ParagraphStyle("lbl", parent=styles["Normal"], fontSize=10, leading=13)
lblb = ParagraphStyle("lblb", parent=styles["Normal"], fontSize=10, leading=13, fontName="DejaVu-Bold")
opt = ParagraphStyle("opt", parent=styles["Normal"], fontSize=9.5, leading=15, textColor=DARK)
note = ParagraphStyle("note", parent=styles["Normal"], fontSize=8.5, textColor=GREY, leading=11)
closing = ParagraphStyle("closing", parent=styles["Normal"], fontSize=10, leading=14, textColor=DARK, fontName="DejaVu-Bold")
pricing = ParagraphStyle("pricing", parent=styles["Normal"], fontSize=11, leading=15, textColor=GREEN, fontName="DejaVu-Bold", alignment=1, spaceAfter=6)

def section(title):
    t = Table([[Paragraph(title, sec)]], colWidths=[176*mm])
    t.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),GREEN),("LEFTPADDING",(0,0),(-1,-1),8),
                           ("TOPPADDING",(0,0),(-1,-1),4),("BOTTOMPADDING",(0,0),(-1,-1),4)]))
    return [Spacer(1,7), t, Spacer(1,5)]

def fill(label, note_txt=None):
    # label on the left, a write-on line on the right
    right = Paragraph(("<font color='#9aa0a6' size=8>"+note_txt+"</font>") if note_txt else "", lbl)
    t = Table([[Paragraph(label, lbl), right]], colWidths=[70*mm, 106*mm])
    t.setStyle(TableStyle([("LINEBELOW",(1,0),(1,0),0.5,LINEGREY),
                           ("VALIGN",(0,0),(-1,-1),"BOTTOM"),
                           ("BOTTOMPADDING",(0,0),(-1,-1),4),("TOPPADDING",(0,0),(-1,-1),5)]))
    return t

def ticks(label, options, cols=3, note_txt=None):
    head = Paragraph(label + ("  <font color='#9aa0a6' size=8>("+note_txt+")</font>" if note_txt else ""), lblb)
    cells = [Paragraph(u"☐  " + o, opt) for o in options]
    while len(cells) % cols: cells.append(Paragraph("", opt))
    rows = [cells[i:i+cols] for i in range(0, len(cells), cols)]
    t = Table(rows, colWidths=[176*mm/cols]*cols)
    t.setStyle(TableStyle([("TOPPADDING",(0,0),(-1,-1),1),("BOTTOMPADDING",(0,0),(-1,-1),1),("LEFTPADDING",(0,0),(-1,-1),0)]))
    return [Spacer(1,4), head, Spacer(1,2), t]

def para(txt, style=note):
    return Paragraph(txt, style)

PROVINCE = ["Eastern Cape","Free State","Gauteng","KwaZulu Natal","Limpopo","Mpumalanga","Northern Cape","North West","Western Cape"]

INTRO = ("Thank you for your interest in listing with Around You — the app that connects holiday guests and "
         "locals with great businesses near them. Please complete the fields below. Fields marked * are required. "
         "Write your details on the lines provided and tick the options that apply.")
FOOTER = "Questions? Contact your Around You agent or sales@aroundyou.co.za."

# The closing note shown directly under the last field, on every form.
CLOSING_NOTE = ("Once submitted and you receive your Access and Edit codes, you will be able to edit all of the "
                "other information you can show on your Partner Profile.")

def repcode():
    return [*section("Agent Code"),
        fill("Agent Code", "Leave as AROUNDYOU unless an agent gave you their own code, then change accordingly")]

def business(nameLabel):
    return [*section("Your business"),
        fill(nameLabel + " *"),
        fill("Contact person *"),
        fill("Contact email *"),
        fill("Contact number *"),
        *ticks("Province *", PROVINCE, cols=3),
        fill("Area *", "your town or suburb — used to list you in the right area"),
        fill("Physical address", "shown to Guests & Locals (leave blank / hidden if you tick below)"),
        *ticks("Do you work from different addresses?", ["Yes — I work from different addresses (hide my address on Guest & Local pages)"], cols=1,
               note_txt="tick if you have no fixed public address; then complete Office address (Official Use) below"),
        fill("Office address (Official Use)", "for accounts/admin only — never shown publicly"),
        fill("Postal code"),
        fill("Holding company (if any)"),
        fill("Company registration number"),
        fill("VAT number (if registered)")]

def closing_block():
    inner = [HRFlowable(width="100%", thickness=0.5, color=LINEGREY, spaceAfter=6),
             Paragraph(CLOSING_NOTE, closing)]
    return [Spacer(1,6), KeepTogether(inner)]

def _pageno(canvas, doc):
    canvas.saveState()
    canvas.setFont("DejaVu", 8)
    canvas.setFillColor(GREY)
    canvas.drawRightString(A4[0]-17*mm, 10*mm, str(doc.page))
    canvas.restoreState()

def sign_block():
    cap = ("I agree to all of the Around You Terms & Conditions and confirm that the information "
           "provided above is true and correct.")
    def two(a, b):
        t = Table([[Paragraph(a, lbl), Paragraph("", lbl), Paragraph(b, lbl), Paragraph("", lbl)]],
                  colWidths=[28*mm, 60*mm, 18*mm, 70*mm])
        t.setStyle(TableStyle([("LINEBELOW",(1,0),(1,0),0.5,LINEGREY),("LINEBELOW",(3,0),(3,0),0.5,LINEGREY),
                               ("VALIGN",(0,0),(-1,-1),"BOTTOM"),("TOPPADDING",(0,0),(-1,-1),7),("BOTTOMPADDING",(0,0),(-1,-1),5)]))
        return t
    inner = [HRFlowable(width="100%", thickness=0.5, color=LINEGREY, spaceAfter=4),
             Paragraph("Agreement", lblb), Paragraph(cap, lbl), Spacer(1,6),
             fill("Signature"), two("Full name", "Date")]
    return [Spacer(1,8), KeepTogether(inner)]

def build(fname, title, story_mid, extra_intro="", price_txt=""):
    doc = SimpleDocTemplate(os.path.join(OUT, fname), pagesize=A4,
                            leftMargin=17*mm, rightMargin=17*mm, topMargin=14*mm, bottomMargin=14*mm, title=title)
    story = []
    if os.path.exists(LOGO):
        try:
            img = Image(LOGO); img._restrictSize(40*mm, 18*mm); img.hAlign="CENTER"; story.append(img); story.append(Spacer(1,4))
        except Exception: pass
    story.append(Paragraph(title, h1))
    story.append(Paragraph(INTRO + (" " + extra_intro if extra_intro else ""), sub))
    if price_txt:
        story.append(Paragraph("Pricing: " + price_txt, pricing))
    story += story_mid
    story += closing_block()
    story += sign_block()
    story.append(Spacer(1,4))
    story.append(HRFlowable(width="100%", thickness=0.5, color=LINEGREY, spaceAfter=3))
    story.append(Paragraph(FOOTER, note))
    doc.build(story, onFirstPage=_pageno, onLaterPages=_pageno)
    print("wrote", fname)

# ===== Restaurant / Takeaway =====
rest = repcode() + business("Restaurant/Takeaway name")
build("restaurant-onboarding.pdf", "Around You — Restaurant/Takeaway Application", rest,
      price_txt="R300 per month, plus Bookings @ R10 per cover and Pre-Orders @ 5% of the bill.")

# ===== Business / Service =====
serv = repcode() + business("Business/Service name")
build("service-onboarding.pdf", "Around You — Business/Service Application", serv,
      price_txt="R300 per month, plus Bookings @ 10% of the bill and Pre-Orders @ 10% of the bill.")

# ===== Attraction / Activity =====
attr = repcode() + business("Attraction/Activity name")
build("attraction-onboarding.pdf", "Around You — Attraction/Activity Application", attr,
      price_txt="R300 per month, plus Bookings @ 10% of the bill and Pre-Orders @ 10% of the bill.")

# ===== Accommodation =====
acc = repcode() + business("Accommodation name") + [
    *section("Accommodation details"),
    fill("Number of units / rooms", "sets your monthly price"),
    para("Monthly price by units:  1–5 = R300  ·  6–10 = R500  ·  11–20 = R800  ·  21–40 = R1,200  ·  40+ = custom quote", lbl),
]
build("accommodation-onboarding.pdf", "Around You — Accommodation Application", acc,
      price_txt="R300 per month.")

# ===== Real Estate & Rentals =====
re_ = repcode() + business("Agency name")
build("real-estate-onboarding.pdf", "Around You — Real Estate & Rentals Application", re_,
      price_txt="Estate Agencies R500 per month and Agents R300 per month each.")

# ===== Retail =====
retail = repcode() + business("Retail business name") + [
    PageBreak(),
    *section("Discounts / Specials"),
    para("List any Discounts or My Stamp Card specials. For each, say who it is for: Guests, Locals or Both."),
    para("Discount example: \u201c10% off all fresh produce on Mondays.\u201d"),
    fill("Discount / Special 1 (Guest / Local / Both)"),
    fill("Discount / Special 2 (Guest / Local / Both)"),
    para("My Stamp Card example \u2014 the earn rule, then the reward:"),
    fill("My Stamp Card \u2014 how a stamp is earned (e.g. 1 stamp per 1L of milk)"),
    fill("My Stamp Card \u2014 the reward (e.g. after 10 stamps, a free coffee)"),
]
build("retail-onboarding.pdf", "Around You \u2014 Retail Application", retail,
      price_txt="R500 per month.")

# ===== NPO / PBO =====
npo = repcode() + business("NPO / PBO name") + [
    *section("Registration numbers"),
    fill("NPO Number *", "required for registered NPO / PBO organisations"),
    fill("PBO Number"),
]
build("npo-onboarding.pdf", "Around You \u2014 NPO / PBO Application", npo,
      price_txt="Free \u2014 no monthly fee for registered NPO / PBO organisations.")

print("done")
