// All site copy and business details live here.
// Edit this file to change prices, FAQs, links, etc. — no component changes needed.

export const site = {
  brand: "Pandora Templates",
  domain: "pandoratemplates.com",
  promise: "Open the box. Everything's ready.",
  handle: "@pandoratemplates",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  instagram: "https://www.instagram.com/pandoratemplates",
  whatsappNumber: "918437512120",
  whatsappMessage: "Hi! I have a question about the Wedding Planner spreadsheet 💍",
  supportEmail: "support@example.com", // TODO: replace with client's email
};

export const whatsappLink = (msg = site.whatsappMessage) =>
  `https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent(msg)}`;

export const product = {
  name: "The Wedding Planner Sheet",
  tagline: "Plan your wedding without losing your mind.",
  price: 2100,
  // Set to null to hide the struck-through "anchor" price.
  compareAtPrice: 4999 as number | null,
  currency: "INR",
  formats: ["Excel", "Google Sheets"],
  // Delivery links (temporary until signed URLs are set up with real payments)
  excelDownload: "/downloads/wedding-planner.xlsx",
  googleSheetsCopy: "https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/copy", // TODO
  includes: [
    "Budget tracker with auto-totals",
    "Guest list + RSVP tracker",
    "Vendor directory & contracts",
    "Payment schedule & due dates",
    "Live dashboard with charts",
    "Excel + Google Sheets versions",
    "Free lifetime updates",
    "WhatsApp support",
  ],
};

export const formatINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export const painPoints = [
  { emoji: "😵‍💫", text: "47 WhatsApp groups. Zero clarity.", color: "bg-blush" },
  { emoji: "🧾", text: "Where did that caterer receipt go?", color: "bg-sand" },
  { emoji: "👵", text: "Forgot to invite Bua ji. Again.", color: "bg-mint" },
  { emoji: "💸", text: "Budget? What budget?", color: "bg-lavender" },
  { emoji: "📞", text: "Did we pay the DJ advance or not?", color: "bg-sand" },
  { emoji: "📒", text: "Notes in 3 diaries and 5 apps", color: "bg-blush" },
];

export const features = [
  { icon: "Calculator", title: "Auto-totals", text: "Type an amount, watch every total, balance & percentage update instantly.", color: "bg-sand text-marigold-deep" },
  { icon: "Users", title: "Guest + RSVP tracker", text: "Bride side, groom side, plus-ones, meal preference, RSVP status — all filterable.", color: "bg-blush text-coral" },
  { icon: "BellRing", title: "Payment reminders", text: "Due dates turn red before they bite. Never miss a vendor advance again.", color: "bg-lavender text-plum" },
  { icon: "FileSpreadsheet", title: "Excel + Google Sheets", text: "Use it offline in Excel or share it live with your partner on Google Sheets.", color: "bg-mint text-teal" },
  { icon: "Smartphone", title: "Works on your phone", text: "Update guest RSVPs from the Google Sheets app while you're at the venue.", color: "bg-blush text-coral" },
  { icon: "RefreshCw", title: "Lifetime updates", text: "Buy once. Every improvement we ship is yours, free, forever.", color: "bg-sand text-marigold-deep" },
] as const;

export const showcaseTabs = [
  {
    id: "budget",
    label: "Budget",
    emoji: "💰",
    video: "/videos/tab-budget.mp4",
    headline: "Every rupee, accounted for.",
    text: "Set your total budget, split it across categories and see exactly what's left — automatically.",
  },
  {
    id: "guests",
    label: "Guests",
    emoji: "👨‍👩‍👧",
    video: "/videos/tab-guests.mp4",
    headline: "500 guests? No sweat.",
    text: "Track invites, RSVPs, side, and meal choice. Filter by family in one click.",
  },
  {
    id: "vendors",
    label: "Vendors",
    emoji: "📸",
    video: "/videos/tab-vendors.mp4",
    headline: "All your vendors, one tab.",
    text: "Contacts, quotes, contracts and notes for every photographer, caterer & decorator.",
  },
  {
    id: "payments",
    label: "Payments",
    emoji: "📅",
    video: "/videos/tab-payments.mp4",
    headline: "No more 'did we pay?'",
    text: "Advances, balances and due dates — colour-coded so nothing slips.",
  },
  {
    id: "dashboard",
    label: "Dashboard",
    emoji: "📊",
    video: "/videos/tab-dashboard.mp4",
    headline: "The whole wedding at a glance.",
    text: "Spent vs. budget, RSVPs confirmed, payments pending — on one beautiful screen.",
  },
] as const;

export type ShowcaseTabId = (typeof showcaseTabs)[number]["id"];

export const steps = [
  { title: "Buy", text: "Secure checkout. UPI, cards, netbanking.", emoji: "🛒" },
  { title: "Get it instantly", text: "Download link on screen + in your inbox.", emoji: "📩" },
  { title: "Make a copy", text: "Open in Excel or copy to your Google Drive.", emoji: "📋" },
  { title: "Plan with calm", text: "Fill it in, relax, and enjoy your shaadi.", emoji: "💃" },
];

// PLACEHOLDER testimonials — replace with real customer reviews before launch.
export const testimonials = [
  { name: "Priya & Arjun", city: "Delhi", text: "We stopped fighting about money. Honestly worth it for that alone.", placeholder: true },
  { name: "Sneha", city: "Pune", text: "The guest tracker saved us. 420 guests and zero confusion.", placeholder: true },
  { name: "Rahul", city: "Bengaluru", text: "My mom now asks ME for the vendor list. Legendary.", placeholder: true },
  { name: "Ananya & Kabir", city: "Mumbai", text: "Shared it on Google Sheets with both families. Game changer.", placeholder: true },
  { name: "Meera", city: "Jaipur", text: "The payment reminders alone paid for the sheet.", placeholder: true },
  { name: "Vikram", city: "Chandigarh", text: "Setup took 10 minutes. Planning got 10x calmer.", placeholder: true },
];

export const faqs = [
  {
    q: "Is this a physical product?",
    a: "No — it's a digital spreadsheet. You get instant download access right after payment, plus an email with your links.",
  },
  {
    q: "Do I need Excel?",
    a: "Nope. You get both an Excel file and a Google Sheets version. Google Sheets is free and works on any phone or laptop.",
  },
  {
    q: "Can I use it on my phone?",
    a: "Yes! Open the Google Sheets version in the free Google Sheets app to update RSVPs and payments on the go.",
  },
  {
    q: "Can my partner and family edit it too?",
    a: "Absolutely. Share your Google Sheets copy with anyone — everyone sees the same live plan.",
  },
  {
    q: "I'm not good with spreadsheets. Will I manage?",
    a: "If you can type in a box, you can use this. Formulas are already built in and each tab has simple instructions.",
  },
  {
    q: "Can I customise categories and columns?",
    a: "Yes. Rename categories, add rows, change colours — it's your sheet.",
  },
  {
    q: "How will I receive it?",
    a: "Instantly. After payment you'll see download buttons, and we'll also email you the links.",
  },
  {
    q: "What if I need help?",
    a: "Message us on WhatsApp anytime — a real person from our team will help you out.",
  },
  {
    q: "Do you offer refunds?",
    a: "Since it's a digital download, we don't usually offer refunds — but if something isn't working, WhatsApp us and we'll make it right.",
  },
];
