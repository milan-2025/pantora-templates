/**
 * Stays (property inventory and discovery): fixed lists and defaults.
 * Pure data, safe to import from both server and browser code.
 */

/** Review / publication workflow. A property is only ever shown to guests when it is "published". */
export const STATUSES = ["draft", "submitted", "under_review", "approved", "rejected", "changes_requested", "published", "inactive"] as const;
export type Status = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<Status, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
  changes_requested: "Changes requested",
  published: "Published",
  inactive: "Inactive",
};

/** Who can find a published property: public (search, home, map, Google), unlisted (share links only) or private (admin and its host). */
export const VISIBILITIES = ["public", "unlisted", "private"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

/** What guests see as the property's availability. */
export const AVAILABILITY = ["available", "limited", "unavailable"] as const;
export type Availability = (typeof AVAILABILITY)[number];
export const AVAILABILITY_LABEL: Record<Availability, string> = { available: "Available", limited: "Limited dates", unavailable: "Not available" };

/** Own properties and collaborating hosts' properties get different ID prefixes (LAC-0001, HST-0001). */
export const OWNERSHIP = ["own", "host"] as const;
export type Ownership = (typeof OWNERSHIP)[number];

export const DEFAULT_PROPERTY_TYPES = ["1BHK", "2BHK", "3BHK", "4BHK+", "Studio", "Villa", "Independent house", "Apartment", "Farmhouse", "Penthouse"];
export const DEFAULT_CATEGORIES = ["Staycation", "Family stay", "Couple-friendly", "Workation", "Party-friendly", "Long stay", "Luxury"];

export const AMENITY_CATEGORIES = ["Bedroom", "Bathroom", "Kitchen", "Entertainment", "Facilities", "Other"] as const;

/** Starting amenities; the admin can add more (Settings → Amenities). Keys never change once used. */
export const DEFAULT_AMENITIES: { key: string; label: string; category: (typeof AMENITY_CATEGORIES)[number] }[] = [
  { key: "ac", label: "Air conditioning", category: "Bedroom" },
  { key: "heating", label: "Heating", category: "Bedroom" },
  { key: "wardrobe", label: "Wardrobe", category: "Bedroom" },
  { key: "extra_bedding", label: "Extra bedding", category: "Bedroom" },
  { key: "geyser", label: "Geyser", category: "Bathroom" },
  { key: "bathtub", label: "Bathtub", category: "Bathroom" },
  { key: "shower", label: "Shower", category: "Bathroom" },
  { key: "washing_machine", label: "Washing machine", category: "Bathroom" },
  { key: "kitchen", label: "Fully equipped kitchen", category: "Kitchen" },
  { key: "refrigerator", label: "Refrigerator", category: "Kitchen" },
  { key: "microwave", label: "Microwave", category: "Kitchen" },
  { key: "gas_stove", label: "Gas stove", category: "Kitchen" },
  { key: "utensils", label: "Cooking utensils", category: "Kitchen" },
  { key: "smart_tv", label: "Smart TV", category: "Entertainment" },
  { key: "home_theatre", label: "Home theatre", category: "Entertainment" },
  { key: "projector", label: "Projector", category: "Entertainment" },
  { key: "music_system", label: "Music system", category: "Entertainment" },
  { key: "wifi", label: "Wi-Fi", category: "Facilities" },
  { key: "power_backup", label: "Power backup", category: "Facilities" },
  { key: "lift", label: "Lift", category: "Facilities" },
  { key: "parking", label: "Parking", category: "Facilities" },
  { key: "pool", label: "Swimming pool", category: "Facilities" },
  { key: "gym", label: "Gym", category: "Facilities" },
  { key: "garden", label: "Garden", category: "Facilities" },
  { key: "badminton", label: "Badminton", category: "Facilities" },
  { key: "security", label: "Security", category: "Facilities" },
  { key: "cctv", label: "CCTV in common areas", category: "Facilities" },
  { key: "balcony", label: "Balcony", category: "Facilities" },
];

export const DEFAULT_FEATURES = [
  "Private theatre", "Private pool", "Mountain view", "City skyline view", "Large balcony", "Luxury interiors",
  "Newly furnished", "Couple-friendly", "Family-friendly", "Workation-friendly", "Pet-friendly",
];

/** Message templates. Placeholders in {braces} are filled in for each property and enquiry. */
export const DEFAULT_TEMPLATES = {
  simple: "Hello, I am interested in this property.\n\nProperty: {title}\nProperty ID: {id}\n\nPlease share more details.",
  dates:
    "Hello, I am interested in booking the following property.\n\nProperty: {title}\nProperty ID: {id}\nLocation: {location}\n\nCheck-in: {checkin}\nCheck-out: {checkout}\nAdults: {adults}\nChildren: {children}\nTotal Guests: {guests}\n\nPlease confirm availability and share the booking details.",
  location: "Hello, I am interested in this property.\n\nProperty: {title}\nProperty ID: {id}\n\nPlease share the exact location and directions.",
  general: "Hello, I am looking for a stay. Please share some options.",
};
export type TemplateKey = keyof typeof DEFAULT_TEMPLATES;

export const DEFAULT_SETTINGS = {
  siteName: "Pandora Stays",
  tagline: "Handpicked homes and stays, shared personally.",
  logoUrl: "",
  contactNumber: "8437512120",
  whatsappNumber: "8437512120",
  templates: { ...DEFAULT_TEMPLATES },
  currency: "INR",
  defaultVisibility: "public" as Visibility,
  defaultShowPrice: true,
  ownPrefix: "LAC",
  hostPrefix: "HST",
  propertyTypes: DEFAULT_PROPERTY_TYPES,
  categories: DEFAULT_CATEGORIES,
  features: DEFAULT_FEATURES,
  showSocietyPublicly: true,
  map: {
    tileUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
    defaultLat: 30.7333,
    defaultLng: 76.7794,
    defaultZoom: 11,
  },
  seo: {
    title: "Stays and holiday homes",
    description: "Browse handpicked apartments, villas and homes. Enquire on WhatsApp in one tap.",
    ogImage: "",
  },
  adminEmail: "",
};
export type Settings = typeof DEFAULT_SETTINGS;

/** Enquiry log: what the guest pressed, or an enquiry the admin typed in. */
export const ENQUIRY_KINDS = ["click", "manual"] as const;
export const ENQUIRY_TYPES = ["simple", "dates", "location", "general"] as const;
export type EnquiryType = (typeof ENQUIRY_TYPES)[number];
export const ENQUIRY_STATUSES = ["new", "contacted", "quoted", "booked", "lost", "spam"] as const;

export const MAX_MEDIA = 60;
export const MAX_IMAGE_MB = 10;
export const MAX_VIDEO_MB = 100;
