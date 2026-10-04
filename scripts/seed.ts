/**
 * Fills an empty database with the starting content (safe to re-run: it updates by slug).
 *   npm run seed
 * After this, everything is edited in the admin at /admin.
 */
import { getPayload } from "payload";
import config from "@payload-config";
import { doc, h, p, ul } from "./lexical";

const payload = await getPayload({ config });
const ctx = { disableRevalidate: true };

async function upsert<T extends "products" | "pages" | "posts">(collection: T, slug: string, data: Record<string, unknown>) {
  const existing = await payload.find({ collection, where: { slug: { equals: slug } }, limit: 1, depth: 0, draft: true });
  if (existing.docs[0]) {
    await payload.update({ collection, id: existing.docs[0].id, data: data as never, context: ctx, draft: false });
    console.log(`updated ${collection}/${slug}`);
  } else {
    await payload.create({ collection, data: data as never, context: ctx });
    console.log(`created ${collection}/${slug}`);
  }
}

/* ---------------- site settings ---------------- */
await payload.updateGlobal({
  slug: "site-settings",
  context: ctx,
  data: {
    brandName: "Pandora Templates",
    tagline: "Beautifully designed, ready-to-use templates for life's big projects.",
    whatsappNumber: "918437512120",
    whatsappMessage: "Hi! I have a question about your templates.",
    instagramUrl: "https://www.instagram.com/pandoratemplates",
    supportEmail: "support@pandoratemplates.com",
    navLinks: [
      { label: "Wedding Planner", url: "/wedding_planner" },
      { label: "Blog", url: "/blog" },
      { label: "Contact", url: "/contact" },
    ],
    navCta: { label: "Shop templates", url: "/#products" },
    footerLinks: [
      { label: "Terms & Conditions", url: "/terms" },
      { label: "Privacy Policy", url: "/privacy" },
      { label: "Refund Policy", url: "/refund" },
      { label: "Contact Us", url: "/contact" },
    ],
  },
});
console.log("updated site-settings");

/* ---------------- wedding planner product ---------------- */
await upsert("products", "wedding_planner", {
  _status: "published",
  name: "The Wedding Planner Sheet",
  slug: "wedding_planner",
  tagline: "Plan your wedding without losing your mind. One connected sheet for budget, guests, vendors and payments.",
  price: 2100,
  formats: ["Excel", "Google Sheets"],
  includes: [
    "Budget tracker with auto-totals",
    "Guest list + RSVP tracker",
    "Vendor directory & contracts",
    "Payment schedule & due dates",
    "Live dashboard with charts",
    "Excel + Google Sheets versions",
    "Free lifetime updates",
    "WhatsApp support",
  ].map((text) => ({ text })),
  googleSheetsCopyUrl: "",
  // The offer starts OFF: set a real regular price, offer price and end date in the admin to turn it on.
  offer: { enabled: false, cap: 200, showCountdown: true, showStock: true },
  showRecentPurchases: true,
  hero: {
    eyebrow: "Wedding planner · Excel + Google Sheets",
    headline: "Your wedding plans,",
    headlineAccent: "sorted.",
    subheadline:
      "Plan your wedding without losing your mind. One connected sheet for your budget, guests, vendors and payments, with every formula already built in.",
    ctaLabel: "Get the planner",
    trustPoints: ["Instant download", "One-time payment", "WhatsApp support"],
    badge: "Formulas already built in",
  },
  audienceLine:
    "Designed for brides, grooms, families, wedding planners, and event managers who want a complete wedding management toolkit.",
  pain: {
    eyebrow: "Sound familiar?",
    heading: "Wedding planning can feel like",
    headingAccent: "chaos.",
    items: [
      { emoji: "😵‍💫", text: "47 WhatsApp groups. Zero clarity." },
      { emoji: "🧾", text: "Where did that caterer receipt go?" },
      { emoji: "👵", text: "Forgot to invite Bua ji. Again." },
      { emoji: "💸", text: "Budget? What budget?" },
      { emoji: "📞", text: "Did we pay the DJ advance or not?" },
      { emoji: "📒", text: "Notes in 3 diaries and 5 apps" },
    ],
    resolution: "One sheet. Everything sorted.",
  },
  showcase: {
    eyebrow: "What's inside",
    heading: "Five tabs.",
    headingAccent: "Zero stress.",
    tabs: [
      { mockup: "budget", label: "Budget", emoji: "💰", headline: "Every rupee, accounted for.", text: "Set your total budget, split it across categories and see exactly what's left, automatically." },
      { mockup: "guests", label: "Guests", emoji: "👨‍👩‍👧", headline: "500 guests? No sweat.", text: "Track invites, RSVPs, side and meal choice. Filter by family in one click." },
      { mockup: "vendors", label: "Vendors", emoji: "📸", headline: "All your vendors, one tab.", text: "Contacts, quotes, contracts and notes for every photographer, caterer and decorator." },
      { mockup: "payments", label: "Payments", emoji: "📅", headline: "No more 'did we pay?'", text: "Advances, balances and due dates, colour-coded so nothing slips." },
      { mockup: "dashboard", label: "Dashboard", emoji: "📊", headline: "The whole wedding at a glance.", text: "Spent vs. budget, RSVPs confirmed, payments pending, all on one screen." },
    ],
  },
  highlights: {
    eyebrow: "Feature highlights",
    heading: "Built around how Indian weddings",
    headingAccent: "really work.",
    items: [
      {
        title: "A budget that updates itself",
        text: "Enter your total once. Every advance, balance and category total recalculates as you go, so you always know what's left.",
        bullets: ["Category-wise split", "Spent vs. remaining at a glance", "Works for multi-day functions"],
        mockup: "budget",
      },
      {
        title: "Guest list and RSVPs in one place",
        text: "Bride's side, groom's side, plus-ones and meal preferences, with live counts for the caterer.",
        bullets: ["Filter by family or side", "RSVP status colours", "Headcount for every function"],
        mockup: "guests",
      },
      {
        title: "Never miss a vendor payment",
        text: "Due dates turn red before they bite. See every advance and balance across all your vendors.",
        bullets: ["Upcoming payments first", "Paid / due tracking", "Vendor contacts and notes"],
        mockup: "payments",
      },
      {
        title: "Your whole wedding on one dashboard",
        text: "Budget used, RSVPs confirmed and payments pending, all in one view to share with family.",
        bullets: ["Charts update automatically", "Share live on Google Sheets", "Print-friendly"],
        mockup: "dashboard",
      },
    ],
  },
  features: {
    eyebrow: "Made for Indian weddings",
    heading: "Everything you need.",
    headingAccent: "Nothing you don't.",
    items: [
      { icon: "Calculator", title: "Auto-totals", text: "Type an amount, watch every total, balance and percentage update instantly." },
      { icon: "Users", title: "Guest + RSVP tracker", text: "Bride side, groom side, plus-ones, meal preference, RSVP status, all filterable." },
      { icon: "BellRing", title: "Payment reminders", text: "Due dates turn red before they bite. Never miss a vendor advance again." },
      { icon: "FileSpreadsheet", title: "Excel + Google Sheets", text: "Use it offline in Excel or share it live with your partner on Google Sheets." },
      { icon: "Smartphone", title: "Works on your phone", text: "Update guest RSVPs from the Google Sheets app while you're at the venue." },
      { icon: "RefreshCw", title: "Lifetime updates", text: "Buy once. Every improvement we ship is yours, free, forever." },
    ],
  },
  steps: {
    eyebrow: "How it works",
    heading: "Ready in about two minutes",
    items: [
      { title: "Buy", text: "Secure checkout. UPI, cards, netbanking." },
      { title: "Get it instantly", text: "Download link on screen and in your inbox." },
      { title: "Make a copy", text: "Open in Excel or copy to your Google Drive." },
      { title: "Plan with calm", text: "Fill it in, relax, and enjoy your shaadi." },
    ],
  },
  // Add REAL customer reviews in the admin; the section stays hidden until then.
  testimonials: { eyebrow: "Kind words", heading: "Loved by couples across India", items: [] },
  faq: {
    eyebrow: "FAQ",
    heading: "Questions? We've got answers.",
    items: [
      { question: "Is this a physical product?", answer: "No, it's a digital spreadsheet. You get instant download access right after payment, plus an email with your links." },
      { question: "Do I need Excel?", answer: "No. You get both an Excel file and a Google Sheets version. Google Sheets is free and works on any phone or laptop." },
      { question: "Can I use it on my phone?", answer: "Yes. Open the Google Sheets version in the free Google Sheets app to update RSVPs and payments on the go." },
      { question: "Can my partner and family edit it too?", answer: "Yes. Share your Google Sheets copy with anyone and everyone sees the same live plan." },
      { question: "I'm not good with spreadsheets. Will I manage?", answer: "If you can type in a box, you can use this. Formulas are already built in and each tab has simple instructions." },
      { question: "Can I customise categories and columns?", answer: "Yes. Rename categories, add rows, change colours. It's your sheet." },
      { question: "How will I receive it?", answer: "Instantly. After payment you'll see download buttons, and we'll also email you the links." },
      { question: "What if I need help?", answer: "Message us on WhatsApp anytime. A real person from our team will help you out." },
      { question: "Do you offer refunds?", answer: "Since it's a digital download, we don't usually offer refunds, but if something isn't working, WhatsApp us and we'll make it right." },
    ],
  },
  contact: {
    show: true,
    heading: "Questions before you buy?",
    text: "Send us a message and we'll get back to you, usually within a few hours.",
  },
  finalCta: {
    heading: "Open the box.",
    headingAccent: "Everything's ready.",
    text: "Spend less time chasing details and more time enjoying the run-up to your big day.",
    buttonLabel: "Get the planner",
  },
  seo: {
    title: "Wedding Planner Spreadsheet (Excel + Google Sheets)",
    description: "Plan your wedding budget, guests, vendors and payments in one connected sheet. Instant download for Excel and Google Sheets.",
  },
});

/* ---------------- pages ---------------- */
await upsert("pages", "home", {
  _status: "published",
  title: "Home",
  slug: "home",
  layout: [
    {
      blockType: "hero",
      eyebrow: "Pandora Templates",
      heading: "Open the box.",
      headingAccent: "Everything's ready.",
      text: "Beautifully designed, ready-to-use templates for life's big projects: weddings, budgets, family and more.",
      primaryLabel: "Shop templates",
      primaryUrl: "/#products",
      secondaryLabel: "See the Wedding Planner",
      secondaryUrl: "/wedding_planner",
    },
    { blockType: "productCards", heading: "Templates for the big moments", text: "Done for you, made for you." },
    {
      blockType: "featureGrid",
      heading: "Why Pandora Templates?",
      items: [
        { icon: "Gift", title: "Ready to use", text: "Open the file and start. Formulas, layouts and instructions are already done." },
        { icon: "FileSpreadsheet", title: "Excel + Google Sheets", text: "Use whichever you like, on your laptop or your phone." },
        { icon: "Heart", title: "Made with care", text: "Thoughtfully designed for real Indian families and real-life planning." },
      ],
    },
    {
      blockType: "cta",
      heading: "Planning a wedding?",
      text: "Our Wedding Planner Sheet keeps your budget, guests, vendors and payments in one place.",
      buttonLabel: "See the Wedding Planner",
      buttonUrl: "/wedding_planner",
      style: "plum",
    },
  ],
  seo: { title: "Pandora Templates: ready-to-use templates for life's big projects" },
});

const legal = (title: string, ...body: ReturnType<typeof p>[]) => ({
  _status: "published",
  title,
  layout: [{ blockType: "richText", content: doc(h("h2", title), p("Last updated: October 2026"), ...body) }],
});

await upsert("pages", "terms", {
  ...legal(
    "Terms & Conditions",
    p("By purchasing from Pandora Templates you agree to these terms."),
    h("h3", "The product"),
    p("You are buying a digital template delivered as a download and/or a Google Sheets copy link. No physical product is shipped."),
    h("h3", "Licence"),
    ul([
      "For your personal, non-commercial use (you may share it with family and people helping you plan).",
      "You may not resell, redistribute or publish the template or modified versions of it.",
    ]),
    h("h3", "Payments"),
    p("Prices are in Indian Rupees (INR). Payments are processed securely by our payment partner; we never see or store your card details."),
    h("h3", "Liability"),
    p("Templates are planning aids. You are responsible for checking your own figures, dates and vendor agreements."),
  ),
  slug: "terms",
});
await upsert("pages", "privacy", {
  ...legal(
    "Privacy Policy",
    h("h3", "What we collect"),
    p("When you buy, we collect your name, email address, phone number and (optionally) your city. Payment details are handled entirely by our payment partner."),
    h("h3", "How we use it"),
    ul([
      "To deliver your purchase and send your download links.",
      "To provide support if you contact us.",
      "If you give your city, your first name and city may appear in a 'recent purchases' notice on our website.",
      "To measure our ads (via the Meta Pixel) so we can reach more people like you.",
    ]),
    h("h3", "Sharing"),
    p("We never sell your data. We only share it with services that help us run the store (payment gateway, email delivery, analytics)."),
    h("h3", "Your choices"),
    p("You can ask us to remove your details from the recent-purchases notice, or delete your data, at any time by contacting us."),
  ),
  slug: "privacy",
});
await upsert("pages", "refund", {
  ...legal(
    "Refund & Cancellation Policy",
    p("Because our products are digital downloads delivered instantly, all sales are generally final once the files have been accessed."),
    h("h3", "We'll make it right"),
    p("If a file doesn't open, is corrupted, or you were charged twice, contact us within 7 days and we will fix the problem or issue a refund."),
    h("h3", "Refund timelines"),
    p("Approved refunds are returned to the original payment method within 5–7 working days."),
  ),
  slug: "refund",
});
await upsert("pages", "contact", {
  _status: "published",
  title: "Contact Us",
  slug: "contact",
  layout: [
    {
      blockType: "contactForm",
      heading: "We'd love to hear from you",
      text: "Questions about a template, an order or a custom request? Send a message or WhatsApp us. We usually reply within a few hours.",
    },
  ],
});

// Example of a page the owner builds themselves. Created as a DRAFT so it isn't public until edited and published.
await upsert("pages", "ultimateweddingplanner", {
  _status: "draft",
  title: "Ultimate Wedding Planner",
  slug: "ultimateweddingplanner",
  layout: [
    {
      blockType: "hero",
      eyebrow: "Example page (draft)",
      heading: "The Ultimate Wedding Planner",
      headingAccent: "bundle.",
      text: "This is an example page built from blocks in the admin. Edit the text, add images, then click Publish.",
      primaryLabel: "See the Wedding Planner",
      primaryUrl: "/wedding_planner",
    },
    {
      blockType: "richText",
      content: doc(
        h("h2", "Write anything here"),
        p("Use headings, lists, links and images, just like in WordPress."),
        ul(["Add or reorder sections with the + button", "Upload images under Images & videos", "Set the page's Google title under the SEO tab"]),
      ),
    },
    { blockType: "cta", heading: "Ready to start planning?", buttonLabel: "Get the planner", buttonUrl: "/wedding_planner", style: "teal" },
  ],
});

/* ---------------- blog ---------------- */
await upsert("posts", "how-to-plan-your-wedding-budget", {
  _status: "draft",
  title: "How to plan your wedding budget (without the stress)",
  slug: "how-to-plan-your-wedding-budget",
  excerpt: "A simple, step-by-step way to set a wedding budget your whole family can agree on.",
  content: doc(
    p("This is a sample blog post created as a draft. Edit it in the admin, add a cover image, and click Publish."),
    h("h2", "1. Agree on a total"),
    p("Start with one number everyone agrees on, then split it across categories."),
    h("h2", "2. Track every advance"),
    p("Write down every advance and balance as you go, so nothing surprises you later."),
  ),
});

console.log("\nSeed complete. Create your admin login at /admin.");
process.exit(0);
