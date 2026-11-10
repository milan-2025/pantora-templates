/** Starting plans for the wedding invite maker. Editable in /admin → Wedding invites → Invite plans & prices. */
export const PLAN_ORDER = ["basic", "premium", "royal"] as const;
export type PlanId = (typeof PLAN_ORDER)[number];

export type PlanDefault = { planId: PlanId; name: string; price: number; tagline: string; badge: string; features: { text: string }[] };

export const DEFAULT_PLANS: PlanDefault[] = [
  {
    planId: "basic",
    name: "Basic",
    price: 799,
    tagline: "Everything to share a beautiful invite",
    badge: "",
    features: [
      { text: "Your own wedding link" },
      { text: "Share on WhatsApp + QR code for printed cards" },
      { text: "All themes and colours" },
      { text: "Events, maps, countdown, photos and music" },
      { text: "Hindi and English" },
    ],
  },
  {
    planId: "premium",
    name: "Premium",
    price: 1999,
    tagline: "Know who is coming",
    badge: "Most chosen",
    features: [
      { text: "Everything in Basic" },
      { text: "Guest list import + send each guest their own link on WhatsApp" },
      { text: "Different events for different guests (family-only Haldi, etc.)" },
      { text: "RSVP tracker with headcount, meals and blessings" },
      { text: "Upload your own music" },
    ],
  },
  {
    planId: "royal",
    name: "Royal",
    price: 3999,
    tagline: "The full experience",
    badge: "",
    features: [
      { text: "Everything in Premium" },
      { text: "Reel-style video invite: preview, download and post on Instagram or WhatsApp status" },
      { text: "Your own .in domain, set up for you" },
      { text: "One free redesign by our team" },
    ],
  },
];
