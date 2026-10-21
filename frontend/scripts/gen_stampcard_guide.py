import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Image,
                                HRFlowable, Table, TableStyle, KeepTogether)
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
h1 = ParagraphStyle("h1", parent=styles["Title"], textColor=GREEN, fontSize=18, spaceAfter=2, alignment=1, fontName="DejaVu-Bold")
sub = ParagraphStyle("sub", parent=styles["Normal"], fontSize=9.5, textColor=colors.HexColor("#555"), spaceAfter=6, leading=13, alignment=1)
sec = ParagraphStyle("sec", parent=styles["Heading2"], textColor=colors.white, fontSize=11.5, spaceBefore=2, spaceAfter=2, leading=14, fontName="DejaVu-Bold")
step = ParagraphStyle("step", parent=styles["Normal"], fontSize=10, leading=15, textColor=DARK, leftIndent=14, spaceAfter=1)
note = ParagraphStyle("note", parent=styles["Normal"], fontSize=8.7, textColor=GREY, leading=11)
intro = ParagraphStyle("intro", parent=styles["Normal"], fontSize=9.6, leading=13.5, textColor=DARK, spaceAfter=4)

def section(title):
    t = Table([[Paragraph(title, sec)]], colWidths=[176*mm])
    t.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),GREEN),("LEFTPADDING",(0,0),(-1,-1),8),
                           ("TOPPADDING",(0,0),(-1,-1),4),("BOTTOMPADDING",(0,0),(-1,-1),4)]))
    return [Spacer(1,6), t, Spacer(1,4)]

def steps(items):
    out = []
    for i, txt in enumerate(items, 1):
        out.append(Paragraph(f'<b>{i}.</b>  {txt}', step))
    return out

FOOTER = "Questions? Contact your Around You agent or sales@aroundyou.co.za."

story = []
if os.path.exists(LOGO):
    try:
        img = Image(LOGO); img._restrictSize(38*mm, 17*mm); img.hAlign="CENTER"; story.append(img); story.append(Spacer(1,3))
    except Exception: pass
story.append(Paragraph("Digital Stamp Card — Business Guide", h1))
story.append(Paragraph("Reward your regulars with a digital loyalty card. You set the rule, add a stamp for each "
                       "purchase, and hand over the reward when the card is full. Customers can never stamp "
                       "their own card — only you do.", sub))

story += section("1.  Set up your card  (once)")
story += steps([
    'Sign in on aroundyou.co.za and choose <b>Partner</b>, then open your business profile.',
    'Scroll to the stamp-card section and tick <b>“Turn the loyalty card on for my customers”</b>.',
    'Set <b>Stamps needed for a reward</b> (for example 10).',
    'Type the <b>Reward</b> the customer earns (for example “Free coffee”).',
    'Tap <b>Save card settings</b>. Your card is now live — your business name shows on it automatically.',
])

story += section("2.  Add a stamp  (every purchase)")
story += steps([
    'In the <b>“Add a stamp”</b> box, pull up the customer’s card: tap <b>Scan customer’s QR code</b> '
    'and point your camera at their screen, <b>or</b> type their <b>mobile number</b> and tap <b>Look up</b>.',
    'Their card appears showing, e.g., <b>“6 of 10 stamps.”</b>',
    'Choose how many stamps to add (usually 1), then tap <b>Add 1 stamp</b>.',
])

story += section("3.  Redeem the reward  (when the card is full)")
story += steps([
    'Pull up the customer’s card the same way — <b>Scan their QR code</b> or <b>Look up</b> their mobile number.',
    'When the card is full you’ll see a green <b>Redeem reward</b> button. Tap it.',
    'You’ll see <b>“Reward redeemed.”</b> Hand over the reward.',
    'The card resets to empty automatically so the customer can start collecting again.',
])

story += section("What your customer does")
story += steps([
    'On their phone, they tap <b>My Stamp Cards</b>, enter their <b>mobile number</b>, and tap <b>Find</b>.',
    'They show you the <b>QR code</b> on their screen (or just give you their mobile number).',
    'When their card is full it shows a <b>“Reward ready!”</b> badge — that’s your cue to redeem it.',
    'If they collect at more than one shop, they <b>swipe</b> to the right card first.',
])

story.append(Spacer(1,8))
story.append(HRFlowable(width="100%", thickness=0.5, color=LINEGREY, spaceAfter=3))
story.append(Paragraph(FOOTER, note))

doc = SimpleDocTemplate(os.path.join(OUT, "stamp-card-guide.pdf"), pagesize=A4,
                        leftMargin=17*mm, rightMargin=17*mm, topMargin=13*mm, bottomMargin=13*mm,
                        title="Around You — Digital Stamp Card Guide")
doc.build(story)
print("wrote stamp-card-guide.pdf")
