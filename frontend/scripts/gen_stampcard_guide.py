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
sub = ParagraphStyle("sub", parent=styles["Normal"], fontSize=9.3, textColor=colors.HexColor("#555"), spaceAfter=3, leading=12.5, alignment=1)
sec = ParagraphStyle("sec", parent=styles["Heading2"], textColor=colors.white, fontSize=11.5, spaceBefore=2, spaceAfter=2, leading=14, fontName="DejaVu-Bold")
step = ParagraphStyle("step", parent=styles["Normal"], fontSize=9.6, leading=13.6, textColor=DARK, leftIndent=14, spaceAfter=0)
note = ParagraphStyle("note", parent=styles["Normal"], fontSize=8.7, textColor=GREY, leading=11)
intro = ParagraphStyle("intro", parent=styles["Normal"], fontSize=9.6, leading=13.5, textColor=DARK, spaceAfter=4)

def section(title):
    t = Table([[Paragraph(title, sec)]], colWidths=[176*mm])
    t.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),GREEN),("LEFTPADDING",(0,0),(-1,-1),8),
                           ("TOPPADDING",(0,0),(-1,-1),4),("BOTTOMPADDING",(0,0),(-1,-1),4)]))
    return [Spacer(1,4), t, Spacer(1,3)]

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
story.append(Paragraph("My Stamp Card — Business Guide", h1))
story.append(Paragraph("Reward your regulars with a digital My Stamp Card. Each promotion you run is its own card: "
                       "you set how a stamp is earned and the reward, add a stamp for every qualifying purchase, and "
                       "hand over the reward when the card is full. Customers can never stamp their own card — only you "
                       "do. Set your cards up on your computer; stamp customers on your phone at the till — everything "
                       "syncs automatically.", sub))

story += section("1.  Set up a My Stamp Card  (on your computer)")
story += steps([
    'Sign in on aroundyou.co.za, choose <b>Partner</b> and open your profile (or set it up from the Admin dashboard).',
    'Go to <b>Discount / Specials</b> and tap <b>+ Add My Stamp Card</b>.',
    'Choose who sees it — <b>Guests, Locals or Both</b> — and tick <b>“Show on Guest/Local pages”</b>.',
    '<i>(Optional)</i> Drag in a <b>product image</b> so shoppers pick the right product.',
    'Fill <b>How a stamp is earned</b> — e.g. “For every 1 litre of milk, you get 1 stamp.”',
    'Fill <b>The reward</b> — e.g. “After 10 stamps, a free coffee.”',
    'Set <b>Stamps needed for the reward</b> (for example 10), then <b>Save</b>.',
    'The card switches on <b>automatically</b> — there is no separate on/off step. Add another promotion (say one for bread) and it becomes its own separate card.',
])

story += section("2.  Add a stamp  (every purchase, on your phone)")
story += steps([
    'Open your profile on your phone and open <b>My Stamp Card</b>.',
    'Tap <b>Scan customer’s QR code</b> and point your camera at their screen, <b>or</b> type their <b>mobile number</b>.',
    'You’ll see a card for <b>each of your promotions</b> (e.g. Milk, Bread). On the one they bought, choose how many stamps (usually 1) and tap <b>Add stamp</b>.',
])

story += section("3.  Redeem the reward  (when a card is full)")
story += steps([
    'Pull up the customer the same way — <b>Scan their QR code</b> or enter their <b>mobile number</b>.',
    'On the full promotion’s card you’ll see a green <b>Redeem reward</b> button. Tap it.',
    'Hand over the reward. The card resets to empty automatically so the customer can start collecting again.',
])

story += section("What your customer does")
story += steps([
    'On your shop’s page they tap <b>Get Stamps</b> on the promotion (or the <b>My Stamp Card</b> button), enter their <b>mobile number</b> and tap <b>Find</b>.',
    'They show you the <b>QR code</b> on their screen (or just give you their mobile number).',
    'Their cards show <b>one per promotion</b>, each labelled — so you both add stamps to the right one.',
    'When a card is full it shows a <b>“Reward ready!”</b> badge — that’s your cue to redeem it.',
])
story.append(Spacer(1,4))
story.append(Paragraph("<b>Running one simple card</b> for a restaurant, service or activity? Your profile has a "
                       "stamp-card section with an on/off switch, a reward and the number of stamps — set those, tap "
                       "Save, and stamp customers exactly as above.", note))

story.append(Spacer(1,3))
story.append(HRFlowable(width="100%", thickness=0.5, color=LINEGREY, spaceAfter=2))
story.append(Paragraph(FOOTER, note))

doc = SimpleDocTemplate(os.path.join(OUT, "stamp-card-guide.pdf"), pagesize=A4,
                        leftMargin=17*mm, rightMargin=17*mm, topMargin=13*mm, bottomMargin=13*mm,
                        title="Around You — My Stamp Card Guide")
doc.build(story)
print("wrote stamp-card-guide.pdf")
