/**
 * The new homepage layout (applied by `npm run publish-content:apply`, see scripts/publish-content.ts).
 * Uses only the page-builder blocks in blocks/index.ts, so everything stays editable in the admin.
 */
type Block = { blockType: string; [k: string]: unknown };

export const HOME_LAYOUT: Block[] = [
  {
    blockType: "hero",
    eyebrow: "Pandora Templates",
    heading: "Life's big projects,",
    headingAccent: "sorted.",
    text: "Plan your wedding online with your whole family, send digital invites your guests will love, use ready-made planner sheets, find a stay or follow up every sales lead. Simple tools, made for Indian families and small businesses.",
    primaryLabel: "Plan your wedding online",
    primaryUrl: "/planner",
    secondaryLabel: "Shop templates",
    secondaryUrl: "/#products",
  },
  {
    blockType: "productHub",
    eyebrow: "Everything Pandora",
    heading: "One place for life's big projects",
    text: "Plan your wedding together with family, send invites your guests will love, find a stay or grow your business. Pick where to start.",
  },
  {
    blockType: "featureGrid",
    heading: "Why people choose Pandora",
    text: "Every tool is built to be picked up in minutes, on the phone you already use.",
    items: [
      { icon: "Users", title: "Made for families and teams", text: "Share one planner with parents, siblings and cousins, or one CRM with your sales team. Everyone sees the same, up-to-date picture." },
      { icon: "Smartphone", title: "Works on your phone", text: "No installs or training. Open it in the browser on any phone or laptop, and add it to your home screen if you like." },
      { icon: "Sparkles", title: "Ready from day one", text: "Layouts, formulas, reminders and wording are already done for you. Open it, fill it in, and get going." },
      { icon: "FileSpreadsheet", title: "Excel and Google Sheets", text: "Our planner sheets work in both, so you can keep using whichever you are comfortable with." },
      { icon: "Heart", title: "Made with care in India", text: "Designed around real Indian weddings, families and businesses: shagun, multiple functions, WhatsApp and all." },
      { icon: "Gift", title: "Try before you commit", text: "Start the online planner and LeadFlow CRM with a free trial. Buy a planner sheet once and it is yours to keep." },
    ],
  },
  { blockType: "productCards", heading: "Templates for the big moments", text: "Done for you, made for you." },
  {
    blockType: "faq",
    heading: "Questions? We've got answers.",
    items: [
      {
        question: "What is Pandora Templates?",
        answer:
          "Pandora is a small family of ready-to-use tools for big life projects: an online wedding planner your family can share, a digital wedding invite maker, planner sheets for Excel and Google Sheets, Pandora Stays for holiday homes, and LeadFlow CRM for teams that get leads from ads.",
      },
      {
        question: "How do I get my planner sheet after paying?",
        answer: "Right after payment you can download your file on the success page, and your links are also sent to your email. If anything goes wrong, message us on WhatsApp and we will sort it out right away.",
      },
      { question: "Do the sheets work in Google Sheets and Excel?", answer: "Yes. Planner sheets work in both Microsoft Excel and Google Sheets, on a laptop or a phone." },
      {
        question: "Can my whole family use the online wedding planner?",
        answer: "Yes. Invite family members to the same planner so everyone can see and update guests, budget, vendors, payments and shagun in one place.",
      },
      { question: "What is your refund policy?", answer: "Please read our Refund & Cancellation Policy at /refund for the full details, or message us if you have a question before you buy." },
      { question: "How can I contact you?", answer: "Use the WhatsApp button on any page or the form on our Contact page. We are happy to help you choose the right tool." },
    ],
  },
  {
    blockType: "cta",
    heading: "Planning a wedding?",
    text: "Bring the whole family into one online planner: guests and RSVPs, budget, vendors, payments and shagun, all in one place.",
    buttonLabel: "Start planning free",
    buttonUrl: "/planner",
    style: "plum",
  },
];

/**
 * The new layout, keeping what the owner chose in the existing Product cards block (its products,
 * heading and text), so a hand-picked product list is not lost.
 */
export function buildHomeLayout(current: Block[] | null | undefined): Block[] {
  const oldCards = (current ?? []).find((b) => b.blockType === "productCards");
  return HOME_LAYOUT.map((b) => {
    if (b.blockType !== "productCards" || !oldCards) return { ...b };
    const products = Array.isArray(oldCards.products) && oldCards.products.length ? { products: oldCards.products } : {};
    return { ...b, heading: oldCards.heading || b.heading, text: oldCards.text || b.text, ...products };
  });
}
