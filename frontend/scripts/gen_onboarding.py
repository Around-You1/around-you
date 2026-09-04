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

OUT = "/sessions/brave-wizardly-fermi/mnt/1au/frontend/public/onboarding"
LOGO = "/sessions/brave-wizardly-fermi/mnt/1au/frontend/public/around-you-logo.png"
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

def bigfill(label, lines=2):
    rows = [[Paragraph(label, lbl)]]
    for _ in range(lines):
        rows.append([Paragraph("", lbl)])
    t = Table(rows, colWidths=[176*mm])
    st = [("TOPPADDING",(0,0),(-1,-1),7),("BOTTOMPADDING",(0,0),(-1,-1),7)]
    for i in range(1, lines+1):
        st.append(("LINEBELOW",(0,i),(0,i),0.5,LINEGREY))
    t.setStyle(TableStyle(st))
    return t

def ticks(label, options, cols=3, note_txt=None):
    head = Paragraph(label + ("  <font color='#9aa0a6' size=8>("+note_txt+")</font>" if note_txt else ""), lblb)
    cells = [Paragraph(u"☐  " + o, opt) for o in options]
    while len(cells) % cols: cells.append(Paragraph("", opt))
    rows = [cells[i:i+cols] for i in range(0, len(cells), cols)]
    t = Table(rows, colWidths=[176*mm/cols]*cols)
    t.setStyle(TableStyle([("TOPPADDING",(0,0),(-1,-1),1),("BOTTOMPADDING",(0,0),(-1,-1),1),("LEFTPADDING",(0,0),(-1,-1),0)]))
    return [Spacer(1,4), head, Spacer(1,2), t]

def grouped_ticks(label, groups):
    out = [Spacer(1,4), Paragraph(label + "  <font color='#9aa0a6' size=8>(tick any that apply)</font>", lblb)]
    for g in groups:
        out.append(Spacer(1,2))
        out.append(Paragraph("<b>"+g["label"]+"</b>", opt))
        cells = [Paragraph(u"☐  " + o, opt) for o in g["subcategories"]]
        while len(cells) % 3: cells.append(Paragraph("", opt))
        rows = [cells[i:i+3] for i in range(0,len(cells),3)]
        t = Table(rows, colWidths=[176*mm/3]*3)
        t.setStyle(TableStyle([("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0),("LEFTPADDING",(0,0),(-1,-1),0)]))
        out.append(t)
    return out

def para(txt, style=note):
    return Paragraph(txt, style)

# ---- real option lists (mirrored from the app) ----
COUNTRY = ["South Africa","Asia","Europe","USA"]
PROVINCE = ["Eastern Cape","Free State","Gauteng","KwaZulu Natal","Limpopo","Mpumalanga","Northern Cape","North West","Western Cape"]
ACCESS = ["Wheelchair Access","Parking Availability"]
DIETARY = ["Gluten Free","Halaal","Kosher","Nut Free","Signature Dish","Chef Recommendation"]
SOCIALS = ["Website","Facebook","Instagram","TikTok","X"]
PAYMENTS = ["Card","Cash","Gaap","Mobile Tap","Snap Scan","Yoco","Zapper"]
FACILITIES = ["Braai","Fly Fishing","Golf","Gym","Laundry","Spa","Swimming Pool"]
ATMOSPHERE = ["Family-friendly","Romantic","Trendy / Modern","Quiet","Lively","Outdoor Seating","Sea View","Mountain View","Rooftop","Garden"]
REST_FEATURES = ["Walk-ins Welcome","Live Music","Free Wi-Fi"]
REST_TYPES = ["Food Truck","Home Meals","Take Away","Pop Up","Restaurant"]
CUISINE = ["African","À la carte","American","Asian","BBQ","Bakery","Boerewors Rolls","Breakfast","Bunny Chow","Burgers","Cafe","Cake","Chinese","Coffee Shop","Croissant","Curry","Dagwood","Deli","Eisbein","Espetada","Fast Food","Fine Dining","French","Gatsby","Greek","Indian","Irish","Italian","Jaffels","Japanese","Mediterranean","Mexican","Middle Eastern","Pancakes","Panini","Pasta","Pizza","Pies","Pita","Quiche","Ribs","Roast","Sandwiches","Scones","Seafood","Spanish","Steaks","Sushi","Soup","Thai","Toasties","Vegan","Vegetarian","Vetkoek"]
ATTRACTION_CATS = ["Artisanal Tastings & Pairings","Beaches & Coastal","Cultural & Historical","Entertainment & Events","Nature & Outdoors","Shopping & Markets","Sports & Adventure","Water-Based Activities","Wellness & Retreats","Wildlife & Eco"]
CATEGORY_GROUPS = [
 {"label":"Accessibility & Languages","subcategories":["Accessibility Consulting","Assistive Technology Services","Braille & Large Print Services","Interpretation Services","Sign Language Support","Translation Services"]},
 {"label":"Business & Admin","subcategories":["Accounting & Bookkeeping","Business Consulting","HR & Recruitment","IT Support & Networking","Legal & Compliance","Office Supplies & Equipment","Printing & Document Services","Virtual Assistants"]},
 {"label":"Community & Local","subcategories":["Charity & Non Profit Services","Community Centres","Local Clubs & Associations","Local Events & Activities","Public Services & Municipal Office","Religious Organizations"]},
 {"label":"Food & Drink","subcategories":["Bakeries","Butcheries & Fishmongers","Catering Services","Fresh Produce Markets","Grocery Stores","Water & Ice Supply"]},
 {"label":"Health & Wellness","subcategories":["Beauty Boutiques","Beauty Treatments","Fitness & Gyms","Fitness & Wellbeing","Grooming Services","Holistic Therapies","Skin Care & Aesthetics","Spas & Beauty Treatments","Wellness Retreats"]},
 {"label":"Home & Property","subcategories":["Architecture","Cleaning Services","Gardening & Landscaping","Home Security","Interior Design & Décor","Pest Control","Pet Sitting","House Sitting"]},
 {"label":"Leisure & Experiences","subcategories":["Arts & Culture","Events & Entertainment","Fitness & Gyms","Kids Activities","Sport Clubs","Tours & Activities"]},
 {"label":"Safety","subcategories":["Emergency Services","Fire & Safety Equipment","First Aid Training","Medical Services","Occupational Health","Pharmacies","Security Services"]},
 {"label":"Services & Trades","subcategories":["Appliance Repairs","Carpenters","Electricians","Handyman Services","Locksmiths","Mechanics","Painters","Plumbers","Welders"]},
 {"label":"Transport","subcategories":["Delivery & Courier Services","Equipment Hire","Freight & Haulage","Logistics Support","Moving Services","Shuttle Services","Taxi & Ride Hailing","Towing Services","Trailer Hire","Vehicle Rentals"]},
]
TABLES = [("Table for 1","R10"),("Table for 2","R20"),("Table for 4","R40"),("Table for 6","R60"),("Table for 8","R80"),("Table for 10","R100"),("Table for 12","R120"),("Table for 14","R140"),("Table for 16","R160"),("Table for 20","R200"),("Table for 20+","R250")]

INTRO = ("Thank you for your interest in listing with Around You — the app that connects holiday guests and "
         "locals with great businesses near them. Please complete the fields below so your Around You "
         "representative can list your business. Tick the options that apply and write your details on the lines provided.")
FOOTER = ("Official Use fields (representative name & code and internal billing details) are completed by your "
          "Around You representative. Questions? Contact your rep or sales@aroundyou.co.za.")

def business():
    return [*section("Business Details"),
        fill("Business / trading name"), fill("Holding company (if applicable)"),
        fill("Company registration number"), fill("VAT number (if VAT-registered)"),
        fill("Business email address"), fill("Business contact number"),
        fill("Person responsible (contact name)"), fill("Person responsible contact number")]

def location():
    return [*section("Location"),
        *ticks("Country", COUNTRY, cols=4),
        *ticks("Province (if South Africa)", PROVINCE, cols=3),
        fill("Physical address"), fill("Postal code"),
        fill("GPS location", "your representative can capture this on site")]

def photos():
    return [*section("Photos & Branding"),
        para("Please attach, by email: (1) your logo, and (2) photos of your business — exterior, interior, and your products / offering.", lbl)]

def payments():
    return [*section("Payment Methods You Accept"), *ticks("Tick all that apply", PAYMENTS, cols=4)]

def socials():
    return [*section("Social & Web Links"),
        fill("Website"), fill("Facebook"), fill("Instagram"), fill("TikTok"), fill("X (Twitter)")]

def discounts():
    return [*section("Discounts for Around You Users (required)"),
        para("These discounts are what attract guests and locals to you. Complete the discount(s) for the audience you'll be shown to.", lbl),
        fill("Guest discount — describe the offer"), fill("Guest discount code"),
        fill("Local discount — describe the offer"), fill("Local discount code")]

def charity():
    return [*section("Charity You'd Like to Support"),
        *ticks("Choose a group (tick one)", ["Adults","Children","Animals"], cols=3),
        *ticks("Choose a focus (tick one)", ["Health","Homes","Food"], cols=3)]

def accessibility():
    return [*section("Accessibility & Family"),
        *ticks("Accessibility options offered", ACCESS, cols=2),
        *ticks("Child friendly", ["Child Friendly"], cols=2)]

def visibility():
    return [*section("How You'd Like to Appear"),
        *ticks("Shown to (tick one)", ["Guest only","Local only","Both"], cols=3),
        para("Or, if you take bookings, ask your rep about a Booking listing (R200/month + R10 per cover). Your rep will confirm the tier and monthly price.", lbl)]


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
    return [Spacer(1,4), KeepTogether(inner)]

def build(fname, title, story_mid, extra_intro=""):
    doc = SimpleDocTemplate(os.path.join(OUT, fname), pagesize=A4,
                            leftMargin=17*mm, rightMargin=17*mm, topMargin=14*mm, bottomMargin=14*mm, title=title)
    story = []
    if os.path.exists(LOGO):
        try:
            img = Image(LOGO); img._restrictSize(40*mm, 18*mm); img.hAlign="CENTER"; story.append(img); story.append(Spacer(1,4))
        except Exception: pass
    story.append(Paragraph(title, h1))
    story.append(Paragraph(INTRO + (" " + extra_intro if extra_intro else ""), sub))
    story += story_mid
    story += sign_block()
    story.append(Spacer(1,4))
    story.append(HRFlowable(width="100%", thickness=0.5, color=LINEGREY, spaceAfter=3))
    story.append(Paragraph(FOOTER, note))
    doc.build(story, onFirstPage=_pageno, onLaterPages=_pageno)
    print("wrote", fname)

# ===== Restaurant =====
rest = business() + location() + visibility() + [PageBreak(), *section("Restaurant Details"),
    fill("Restaurant name"),
    *ticks("Restaurant type", REST_TYPES, cols=3),
    *ticks("Cuisine type(s)", CUISINE, cols=4),
    *ticks("Atmosphere", ATMOSPHERE, cols=3),
    *ticks("Features", REST_FEATURES, cols=3),
    *ticks("Dietary options", DIETARY, cols=3),
    bigfill("Description", 2),
    fill("Public listing address"),
    fill("Menu link (or attach a menu PDF by email)"),
    *ticks("Service options", ["Dine-in","Takeaway","Delivery"], cols=3),
    fill("Wi-Fi network name"), fill("Wi-Fi password"),
] + [PageBreak(), *section("Table Bookings (if you take bookings)"),
    para("Standard table options and prices (R10 per seat). Tick the tables you offer; adjust prices only if different.", lbl),
    *ticks("Tables offered", [f"{n} = {p}" for n,p in TABLES], cols=3),
    fill("Bookings email address"), fill("Bookings contact number"),
] + discounts() + payments() + socials() + accessibility() + [PageBreak()] + charity()
build("restaurant-onboarding.pdf", "Around You — Restaurant Onboarding", rest)

# ===== Service =====
serv = business() + location() + visibility() + [PageBreak(), *section("Service Details"),
    fill("Service name"),
    *grouped_ticks("Service category(ies)", CATEGORY_GROUPS),
    bigfill("Description", 2),
] + [PageBreak(), *section("Good-to-know Info"),
    fill("Safety information"), fill("Age restrictions"), fill("Fitness level required"),
    fill("Best time of day"), fill("What to bring"),
] + [*section("Bookable Items (if you take bookings)"),
    para("List each item a guest can book — name, price (Rand) and duration (minutes).", lbl),
    fill("Item 1 — name / price / minutes"), fill("Item 2 — name / price / minutes"),
    fill("Item 3 — name / price / minutes"), fill("Item 4 — name / price / minutes"),
] + discounts() + payments() + socials() + [PageBreak()] + accessibility() + charity()
build("service-onboarding.pdf", "Around You — Service Onboarding", serv)

# ===== Attraction =====
attr = business() + location() + visibility() + [PageBreak(), *section("Attraction Details"),
    fill("Attraction name"),
    *ticks("Attraction category(ies)", ATTRACTION_CATS, cols=2),
    bigfill("Description", 2),
] + [*section("Good-to-know Info"),
    fill("Safety information"), fill("Age restrictions"), fill("Fitness level required"),
    fill("Best time of day"), fill("What to bring"),
    fill("Trail difficulty"), fill("Wildlife cautions"), fill("Tide warnings"),
    fill("Parking notes"), fill("Photography spots"),
] + [*section("Bookable Items (if you take bookings)"),
    para("List each item a guest can book — name, price (Rand) and duration (minutes).", lbl),
    fill("Item 1 — name / price / minutes"), fill("Item 2 — name / price / minutes"),
    fill("Item 3 — name / price / minutes"), fill("Item 4 — name / price / minutes"),
] + [PageBreak()] + discounts() + payments() + socials() + accessibility() + charity()
build("attraction-onboarding.pdf", "Around You — Attraction Onboarding", attr)

# ===== Accommodation =====  (no visibility/discounts/payments/socials in the app)
acc = business() + location() + [*section("Accommodation Details"),
    fill("Accommodation name"),
    fill("Number of units / rooms", "sets your monthly price"),
    para("Monthly price by units:  1–5 = R300  ·  6–10 = R500  ·  11–20 = R800  ·  21–40 = R1,200  ·  40+ = custom quote", lbl),
    fill("Contact"),
    bigfill("Description", 2),
    bigfill("Check-in instructions", 2),
    bigfill("Check-out instructions", 2),
    bigfill("Amenities", 2),
    bigfill("House guidelines", 2),
    *ticks("Facilities", FACILITIES, cols=3),
    fill("Wi-Fi network name"), fill("Wi-Fi password"),
] + [*section("Emergency Contacts (shown to your guests)"),
    fill("Police"), fill("Ambulance"), fill("Fire department"),
    fill("Nearest hospital — number"), fill("Nearest hospital — address"),
    fill("Doctor — name / number / address"), fill("Doctor 2 — name / number / address"),
    fill("Vet — name / number / address"), fill("Vet 2 — name / number / address"),
    fill("Sea Rescue / NSRI"), fill("Snake catcher"), fill("Community watch"), fill("Local security"),
] + [PageBreak()] + accessibility() + charity()
build("accommodation-onboarding.pdf", "Around You — Accommodation Onboarding", acc)

# ===== Real Estate =====
re_ = [*section("Agency Details"),
    fill("Agency name"), bigfill("Description",2), fill("Address"),
    *ticks("Province", PROVINCE, cols=3),
    fill("Postal code"), fill("Contact number"), fill("Email address"),
    fill("Company registration number"), fill("VAT number (if VAT-registered)"),
    para("Please attach, by email: agency logo and photos.", lbl),
] + [*section("Agent Details (per agent page)"),
    fill("Agent full name"), fill("Contact number"), fill("Email address"),
    bigfill("Short bio",2), fill("Agency name (if a standalone agent)"),
    para("Please attach, by email: the agent's photo.", lbl),
] + [*section("Property Listing (per property)"),
    fill("Listing title"), fill("Property type (e.g. House, Apartment, Plot)"),
    *ticks("Listing type", ["For Sale","To Rent"], cols=2),
    fill("Price (Rand)"),
    fill("Bedrooms"), fill("Bathrooms"), fill("Garages"),
    fill("Plot size (m2)"), fill("House size (m2)"),
    fill("Features (e.g. Pool, Garden, Security)"),
    fill("Address"),
    *ticks("Province", PROVINCE, cols=3),
    fill("Postal code"), bigfill("Description",2),
    para("Please attach, by email: photos of the property.", lbl),
]
build("real-estate-onboarding.pdf", "Around You — Real Estate & Rentals Onboarding", re_,
      extra_intro="This covers estate agencies, individual agents, and property listings.")
print("done")
