/** Starting plans for wedding photo galleries. Editable in /admin → Wedding photos → Photo gallery plans & prices. */
export const PHOTO_PLAN_ORDER = ["free", "basic", "premium", "royal"] as const;
export type PhotoPlanId = (typeof PHOTO_PLAN_ORDER)[number];
export const PAID_PHOTO_PLANS = ["basic", "premium", "royal"] as const;
export type PaidPhotoPlanId = (typeof PAID_PHOTO_PLANS)[number];

export type PhotoPlanDefault = {
  planId: PhotoPlanId;
  name: string;
  price: number;
  tagline: string;
  badge: string;
  /** Most photos the gallery can hold. */
  maxPhotos: number;
  /** Total video size allowed, in GB. 0 = no videos. */
  videoGb: number;
  /** How long the gallery stays online after payment (or after sign-up, for Free). In months; Free uses days. */
  months: number;
  freeDays?: number;
  guestUploads: boolean;
  /** Keep and offer the full-size camera files for download. */
  originals: boolean;
  features: { text: string }[];
};

export const DEFAULT_PHOTO_PLANS: PhotoPlanDefault[] = [
  {
    planId: "free",
    name: "Free",
    price: 0,
    tagline: "Try it with your favourite photos",
    badge: "",
    maxPhotos: 300,
    videoGb: 0,
    months: 0,
    freeDays: 30,
    guestUploads: false,
    originals: false,
    features: [{ text: "Up to 300 photos" }, { text: "Online for 30 days" }, { text: "Albums, QR code and WhatsApp sharing" }],
  },
  {
    planId: "basic",
    name: "Basic",
    price: 1299,
    tagline: "All your wedding photos in one link",
    badge: "",
    maxPhotos: 3000,
    videoGb: 0,
    months: 12,
    guestUploads: false,
    originals: false,
    features: [
      { text: "Up to 3,000 photos" },
      { text: "Albums for every function (Haldi, Sangeet, Wedding…)" },
      { text: "QR code for the venue + WhatsApp sharing" },
      { text: "Optional PIN so only your guests can open it" },
      { text: "Online for 1 year" },
    ],
  },
  {
    planId: "premium",
    name: "Premium",
    price: 2999,
    tagline: "Photos, videos and your guests' clicks",
    badge: "Most chosen",
    maxPhotos: 8000,
    videoGb: 5,
    months: 24,
    guestUploads: true,
    originals: false,
    features: [
      { text: "Everything in Basic" },
      { text: "Up to 8,000 photos" },
      { text: "Wedding film and highlight videos (5 GB)" },
      { text: "Guests add their own photos (you approve them)" },
      { text: "Online for 2 years" },
    ],
  },
  {
    planId: "royal",
    name: "Royal",
    price: 5999,
    tagline: "Every photo, full size, for years",
    badge: "",
    maxPhotos: 20000,
    videoGb: 25,
    months: 60,
    guestUploads: true,
    originals: true,
    features: [
      { text: "Everything in Premium" },
      { text: "Up to 20,000 photos and 25 GB of video" },
      { text: "Full-size camera originals to download" },
      { text: "Online for 5 years" },
    ],
  },
];

export const DEFAULT_RENEWAL_PRICE = 399;
