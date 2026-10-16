// onboardingSchema.ts
//
// SINGLE SOURCE OF TRUTH for the partner onboarding forms. Both the online forms
// and the printable blank forms (app/onboarding/print/[type]) are meant to read
// from here, so a printed form can never fall out of date with the app: add a
// field or an option once, here, and it shows up everywhere.
//
// Phase 1 (now): the printable blank forms render from this file.
// Phase 2 (later): the online form components import their option lists from the
// exported consts below so the choices are shared, not duplicated.

// ---- Shared option lists ---------------------------------------------------

export const SA_PROVINCES = [
  "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo",
  "Mpumalanga", "North West", "Northern Cape", "Western Cape",
];

export const GUEST_TYPE_OPTIONS = ["Guest Only", "Local", "Both"];
export const TIER_OPTIONS = ["Basic", "Premium"];

export const PAYMENT_METHODS = [
  "Card", "Cash", "Mobile Tap", "Gaap", "Snap Scan", "Yoco", "Zapper", "EFT",
];

export const SOCIAL_LABELS = ["Website", "Facebook", "Instagram", "X (Twitter)", "TikTok"];

export const CUISINE_TYPES = [
  "African", "American", "Asian", "BBQ", "Breakfast", "Bunny Chow", "Burgers", "Cafe",
  "Chinese", "Dagwood", "Deli", "Fast Food", "Fine Dining", "French", "Gatsby", "Greek",
  "Indian", "Irish", "Italian", "Jaffels", "Japanese", "Mediterranean", "Mexican",
  "Middle Eastern", "Pasta", "Pizza", "Ribs", "Seafood", "Spanish", "Steaks", "Sushi",
  "Thai", "Vegan", "Vegetarian", "Vetkoek",
];

export const RESTAURANT_TYPES = ["Food Truck", "Home Meals", "Take Away", "Delivery", "Pop Up", "Restaurant"];

export const ATMOSPHERE_OPTIONS = [
  "Family-friendly", "Romantic", "Trendy / Modern", "Quiet", "Lively",
  "Outdoor Seating", "Sea View", "Mountain View", "Rooftop", "Garden",
];

export const RESTAURANT_FEATURES = ["Walk-ins Welcome", "Live Music", "Free Wi-Fi"];

export const DIETARY_OPTIONS = [
  "Gluten Free", "Halaal", "Kosher", "Nut Free", "Signature Dish", "Chef Recommendation",
];

export const SERVICE_OPTIONS = ["Dine-in", "Takeaway", "Delivery"];

export const ACCESSIBILITY_OPTIONS = ["Wheelchair Access", "Parking Available"];

export interface CategoryGroup {
  label: string;
  options: string[];
}

// Business/Service categories. Adding a subcategory here (e.g. "Gas
// Provider/Refill") is the ONE place it needs to change.
export const SERVICE_CATEGORY_GROUPS: CategoryGroup[] = [
  { label: "Accessibility & Languages", options: ["Accessibility Consulting", "Assistive Technology Services", "Braille & Large Print Services", "Interpretation Services", "Sign Language Support", "Translation Services"] },
  { label: "Business & Admin", options: ["Accounting & Bookkeeping", "Business Consulting", "HR & Recruitment", "IT Support & Networking", "Legal & Compliance", "Office Supplies & Equipment", "Printing & Document Services", "Virtual Assistants"] },
  { label: "Community & Local", options: ["Charity & Non Profit Services", "Community Centres", "Local Clubs & Associations", "Local Events & Activities", "Public Services & Municipal Office", "Religious Organizations"] },
  { label: "Food & Drink", options: ["Bakeries", "Butcheries & Fishmongers", "Catering Services", "Fresh Produce Markets", "Grocery Stores", "Water & Ice Supply"] },
  { label: "Health & Wellness", options: ["Beauty Boutiques", "Beauty Treatments", "Fitness & Gyms", "Fitness & Wellbeing", "Grooming Services", "Holistic Therapies", "Skin Care & Aesthetics", "Spas & Beauty Treatments", "Wellness Retreats"] },
  { label: "Hobby & Craft Supplies", options: ["Wool & Craft"] },
  { label: "Home & Property", options: ["Architecture", "Cleaning Services", "Gardening & Landscaping", "Home Security", "Interior Design & Décor", "Laundry", "Pest Control", "Pet Sitting", "House Sitting"] },
  { label: "Leisure & Experiences", options: ["Arts & Culture", "Events & Entertainment", "Fitness & Gyms", "Kids Activities", "Sport Clubs", "Tours & Activities"] },
  { label: "Safety", options: ["Emergency Services", "Fire & Safety Equipment", "First Aid Training", "Medical Services", "Occupational Health", "Pharmacies", "Security Services", "Veterinary"] },
  { label: "Services & Trades", options: ["Appliance Repairs", "Carpenters", "Electricians", "Gas Provider/Refill", "Handyman Services", "Locksmiths", "Mechanics", "Painters", "Plumbers", "Welders"] },
  { label: "Transport", options: ["Delivery & Courier Services", "Equipment Hire", "Freight & Haulage", "Logistics Support", "Moving Services", "Shuttle Services", "Taxi & Ride Hailing", "Towing Services", "Trailer Hire", "Vehicle Rentals"] },
];

export const ATTRACTION_CATEGORIES = [
  "Artisanal Tastings & Pairings", "Beaches & Coastal", "Cultural & Historical",
  "Entertainment & Events", "Free", "Nature & Outdoors", "Shopping & Markets",
  "Sports & Adventure", "Water-Based Activities", "Wellness & Retreats", "Wildlife & Eco",
];

export const FACILITIES = ["Braai", "Fly Fishing", "Golf", "Gym", "Laundry", "Spa", "Swimming Pool"];

export const PROPERTY_COUNTS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

// ---- Field / section model -------------------------------------------------

export type FieldKind =
  | "text"        // one blank write-in line
  | "long"        // multi-line write-in box
  | "choose-one"  // options, circle/tick ONE
  | "choose-many" // options, tick ALL that apply
  | "groups"      // grouped options (categories), tick all that apply
  | "yesno"       // single Yes / No tick
  | "table"       // repeatable rows with columns
  | "note";       // instruction text, no write-in

export interface Field {
  label: string;
  kind: FieldKind;
  options?: string[];
  groups?: CategoryGroup[];
  columns?: string[];
  rows?: number;   // blank rows for a table
  lines?: number;  // blank lines for a long box
  note?: string;   // helper text under the label
}

export interface Section {
  title: string;
  intro?: string;
  fields: Field[];
}

export interface CategorySchema {
  key: string;
  title: string;
  sections: Section[];
}

// ---- Reusable section builders (shared across categories) -------------------

function officialUse(_withTier: boolean): Section {
  const fields: Field[] = [];
  fields.push(
    { label: "Holding Company", kind: "text" },
    { label: "Person Responsible", kind: "text" },
    { label: "Person Responsible Number", kind: "text" },
    { label: "Email (where the invoice is sent)", kind: "text" },
    { label: "Company Registration Number", kind: "text" },
    { label: "Company VAT Number", kind: "text" },
    { label: "Rep Code", kind: "text" },
    { label: "Rep Name", kind: "text" },
    { label: "Please give us the details of the charity you wish US to support:", kind: "note" },
    { label: "Charity — Name", kind: "text" },
    { label: "Charity — Address", kind: "text" },
    { label: "Charity — Contact number", kind: "text" },
  );
  return {
    title: "Official Use (billing — must be accurate)",
    intro: "Decides who is billed and where the invoice is sent.",
    fields,
  };
}

function businessDetails(nameLabel: string): Section {
  return {
    title: "Business details & location",
    fields: [
      { label: nameLabel, kind: "text" },
      { label: "Contact Number", kind: "text" },
      { label: "Address", kind: "text" },
      { label: "Works from different addresses?", kind: "yesno" },
      { label: "GPS coordinates (Latitude / Longitude)", kind: "text", note: "Captured on the app with 'Use my current location', or read off Google Maps." },
      { label: "Country", kind: "text" },
      { label: "Province", kind: "choose-one", options: SA_PROVINCES },
      { label: "Area", kind: "text" },
      { label: "Postal Code", kind: "text" },
    ],
  };
}

function discountsSection(): Section {
  return {
    title: "Discounts",
    intro: "Fill in only the audience(s) the partner offers to.",
    fields: [
      { label: "Guest discount offered", kind: "text" },
      { label: "Guest discount code", kind: "text" },
      { label: "Local discount offered", kind: "text" },
      { label: "Local discount code", kind: "text" },
    ],
  };
}

function paymentsSection(): Section {
  return { title: "Payment options", fields: [{ label: "Accepted payment methods", kind: "choose-many", options: PAYMENT_METHODS }] };
}

function accessibilitySection(): Section {
  return {
    title: "Accessibility & family",
    fields: [
      { label: "Accessibility", kind: "choose-many", options: ACCESSIBILITY_OPTIONS },
      { label: "Child Friendly", kind: "yesno" },
    ],
  };
}

function socialSection(): Section {
  return { title: "Social media", fields: SOCIAL_LABELS.map((l) => ({ label: l, kind: "text" as FieldKind })) };
}

function imagesSection(what: string): Section {
  return { title: "Images", fields: [{ label: `${what} photos`, kind: "note", note: "Attach up to 10 photos (emailed to head office or uploaded on the app)." }] };
}

function signatureSection(): Section {
  return {
    title: "Confirmation",
    fields: [
      { label: "The partner confirms the information above is correct and accepts the Terms & Conditions.", kind: "note" },
      { label: "Signature", kind: "text" },
      { label: "Date", kind: "text" },
    ],
  };
}

const experienceInfo: Field[] = [
  { label: "Safety Info", kind: "text" },
  { label: "Age Restrictions", kind: "text" },
  { label: "Fitness Level", kind: "text" },
  { label: "Best Time of Day", kind: "text" },
  { label: "What to Bring", kind: "text" },
];

// ---- Per-category schemas --------------------------------------------------

const restaurant: CategorySchema = {
  key: "restaurant",
  title: "Restaurant / Takeaway",
  sections: [
    officialUse(true),
    businessDetails("Restaurant / Takeaway Name"),
    { title: "Cuisine Types", fields: [{ label: "Cuisine Types", kind: "choose-many", options: CUISINE_TYPES }] },
    { title: "Restaurant / Takeaway Type", fields: [{ label: "Type", kind: "choose-many", options: RESTAURANT_TYPES }] },
    { title: "Atmosphere / Vibe", fields: [{ label: "Atmosphere / Vibe", kind: "choose-many", options: ATMOSPHERE_OPTIONS }] },
    { title: "Features", fields: [{ label: "Features", kind: "choose-many", options: RESTAURANT_FEATURES }] },
    { title: "Dietary Options", fields: [
      { label: "Dietary Options", kind: "choose-many", options: DIETARY_OPTIONS },
      { label: "Chef recommendation (if selected above)", kind: "text" },
    ] },
    {
      title: "Description & hours",
      fields: [
        { label: "Description", kind: "long", lines: 4 },
        { label: "Trading Hours", kind: "long", lines: 3 },
        { label: "Public Holidays", kind: "long", lines: 2 },
        { label: "Menu link", kind: "text" },
        { label: "Menu PDF", kind: "note", note: "Attach menu PDF(s) if available." },
      ],
    },
    paymentsSection(),
    { title: "Service options", fields: [{ label: "Service options", kind: "choose-many", options: SERVICE_OPTIONS }] },
    accessibilitySection(),
    { title: "WiFi", fields: [{ label: "WiFi Network", kind: "text" }, { label: "WiFi Password", kind: "text" }] },
    discountsSection(),
    {
      title: "Bookings (optional)",
      intro: "Only if the restaurant takes table bookings through the app (R10 per cover).",
      fields: [
        { label: "Offers table bookings?", kind: "yesno" },
        { label: "Bookings Email", kind: "text" },
        { label: "Bookings Contact Number", kind: "text" },
        { label: "Bookable tables", kind: "table", columns: ["Table (item)", "Price (R)"], rows: 6 },
      ],
    },
    {
      title: "Pre-orders (optional)",
      intro: "Takeaway / delivery only — 5% of each pre-order.",
      fields: [
        { label: "Offers pre-orders?", kind: "yesno" },
        { label: "Pre-order items", kind: "table", columns: ["Item", "Price (R)", "Prep time (min)"], rows: 6 },
      ],
    },
    socialSection(),
    imagesSection("Restaurant"),
    signatureSection(),
  ],
};

const service: CategorySchema = {
  key: "service",
  title: "Business / Service",
  sections: [
    officialUse(true),
    businessDetails("Business / Service Name"),
    { title: "Business / Service Categories", intro: "Tick all that apply.", fields: [{ label: "Categories", kind: "groups", groups: SERVICE_CATEGORY_GROUPS }] },
    {
      title: "Description & hours",
      fields: [
        { label: "Description", kind: "long", lines: 4 },
        { label: "Trading Hours", kind: "long", lines: 3 },
        { label: "Public Holidays", kind: "long", lines: 2 },
      ],
    },
    { title: "Good to know", fields: experienceInfo },
    paymentsSection(),
    accessibilitySection(),
    discountsSection(),
    {
      title: "Bookings (optional)",
      intro: "Only if the business takes bookings through the app (10% per service).",
      fields: [
        { label: "Offers bookings?", kind: "yesno" },
        { label: "Bookable items", kind: "table", columns: ["Item", "Price (R)", "Duration (min)"], rows: 6 },
      ],
    },
    socialSection(),
    imagesSection("Business / Service"),
    signatureSection(),
  ],
};

const attraction: CategorySchema = {
  key: "attraction",
  title: "Attraction / Activity",
  sections: [
    officialUse(true),
    businessDetails("Attraction Name"),
    { title: "Attraction Categories", intro: "Tick all that apply.", fields: [{ label: "Categories", kind: "choose-many", options: ATTRACTION_CATEGORIES }] },
    {
      title: "Description & hours",
      fields: [
        { label: "Description", kind: "long", lines: 4 },
        { label: "Trading Hours", kind: "long", lines: 3 },
        { label: "Public Holidays", kind: "long", lines: 2 },
      ],
    },
    { title: "Good to know", fields: experienceInfo },
    {
      title: "Attraction extras",
      fields: [
        { label: "Trail Difficulty", kind: "text" },
        { label: "Wildlife Cautions", kind: "text" },
        { label: "Tide Warnings", kind: "text" },
        { label: "Parking Notes", kind: "text" },
        { label: "Photography Spots", kind: "text" },
      ],
    },
    paymentsSection(),
    accessibilitySection(),
    discountsSection(),
    {
      title: "Bookings (optional)",
      intro: "Only if the attraction takes bookings through the app (10% per person).",
      fields: [
        { label: "Offers bookings?", kind: "yesno" },
        { label: "Bookable items", kind: "table", columns: ["Item", "Price (R)", "Duration (min)"], rows: 6 },
      ],
    },
    socialSection(),
    imagesSection("Attraction"),
    signatureSection(),
  ],
};

const accommodation: CategorySchema = {
  key: "accommodation",
  title: "Accommodation",
  sections: [
    officialUse(false),
    {
      title: "Accommodation details & location",
      fields: [
        { label: "Accommodation Name", kind: "text" },
        { label: "Address", kind: "text" },
        { label: "GPS coordinates (Latitude / Longitude)", kind: "text" },
        { label: "Country", kind: "text" },
        { label: "Province", kind: "choose-one", options: SA_PROVINCES },
        { label: "Area", kind: "text" },
        { label: "Postal Code", kind: "text" },
        { label: "Contact", kind: "text" },
        { label: "Number of Units / Rooms", kind: "text", note: "Sets the monthly price (1–5 base · 6–10 · 11–20 · 21–40 · 40+ custom)." },
        { label: "Description", kind: "long", lines: 3 },
      ],
    },
    { title: "WiFi", fields: [{ label: "WiFi Name", kind: "text" }, { label: "WiFi Password", kind: "text" }] },
    {
      title: "Guest information",
      fields: [
        { label: "Check-in Instructions", kind: "long", lines: 3 },
        { label: "Amenities", kind: "long", lines: 2 },
        { label: "House Guidelines", kind: "long", lines: 3 },
        { label: "Check-out Instructions", kind: "long", lines: 2 },
      ],
    },
    { title: "Facilities", fields: [{ label: "Facilities", kind: "choose-many", options: FACILITIES }] },
    {
      title: "Emergency contacts",
      intro: "Power the guest emergency-directions buttons — get as many as possible.",
      fields: [
        { label: "Public Ambulance", kind: "text" },
        { label: "Private Ambulance", kind: "text" },
        { label: "Police", kind: "text" },
        { label: "Fire Department", kind: "text" },
        { label: "Primary Contact", kind: "text" },
        { label: "Hospital — number", kind: "text" },
        { label: "Hospital — address", kind: "text" },
        { label: "Snake Catchers", kind: "text" },
        { label: "NSRI / Sea Rescue", kind: "text" },
        { label: "Community Watch", kind: "text" },
        { label: "Local Security", kind: "text" },
        { label: "Doctors", kind: "table", columns: ["Name", "Number", "Address"], rows: 3 },
        { label: "Vets", kind: "table", columns: ["Name", "Number", "Address"], rows: 2 },
      ],
    },
    { title: "Accessibility", fields: [{ label: "Accessibility", kind: "choose-many", options: ACCESSIBILITY_OPTIONS }] },
    imagesSection("Accommodation"),
    signatureSection(),
  ],
};

const realEstate: CategorySchema = {
  key: "real-estate",
  title: "Real Estate & Rentals",
  sections: [
    officialUse(false),
    {
      title: "Agency details",
      fields: [
        { label: "Agency name", kind: "text" },
        { label: "Address", kind: "text" },
        { label: "Province", kind: "choose-one", options: SA_PROVINCES },
        { label: "Postal code", kind: "text" },
        { label: "Contact number", kind: "text" },
        { label: "Email", kind: "text" },
        { label: "Company Registration / VAT number", kind: "text" },
        { label: "Agency logo & photos", kind: "note", note: "Attach by email." },
      ],
    },
    {
      title: "Agent details (one page per agent)",
      fields: [
        { label: "Agent name", kind: "text" },
        { label: "Agency name (if standalone agent)", kind: "text" },
        { label: "Contact number", kind: "text" },
        { label: "Email", kind: "text" },
        { label: "Province", kind: "choose-one", options: SA_PROVINCES },
        { label: "Postal code", kind: "text" },
        { label: "Address", kind: "text" },
        { label: "Short bio", kind: "long", lines: 3 },
        { label: "Agent photo & gallery", kind: "note", note: "Attach by email (up to 10 photos)." },
      ],
    },
    {
      title: "Property listings (one row per property)",
      fields: [
        {
          label: "Properties",
          kind: "table",
          columns: ["Code", "Type", "Sale / Rent", "Price", "Beds", "Baths", "Garages"],
          rows: 6,
        },
        { label: "Property description & features (per property)", kind: "long", lines: 4 },
        { label: "Property photos", kind: "note", note: "Attach by email (up to 10 per property)." },
      ],
    },
    signatureSection(),
  ],
};

export const ONBOARDING_SCHEMA: Record<string, CategorySchema> = {
  restaurant,
  service,
  attraction,
  accommodation,
  "real-estate": realEstate,
};

export function getCategorySchema(key: string): CategorySchema | undefined {
  return ONBOARDING_SCHEMA[key];
}
