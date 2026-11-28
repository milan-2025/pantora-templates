import type { GlobalConfig } from "payload";
import { authenticated } from "@/lib/cms/access";

/**
 * Emails to people who bought a sheet, offering the app made for the same job, with a coupon code:
 * Wedding Planner Sheet buyers → the Online Wedding Planner, Workout Challenge Tracker buyers → Pandora Workout.
 * Sent once per person, in small daily batches, with an unsubscribe link. See lib/buyerOffers.ts.
 */
export const BuyerOffers: GlobalConfig = {
  slug: "buyer-offers",
  label: "Past buyer offers",
  admin: {
    group: "Settings",
    description:
      "Emails past sheet buyers an offer for the matching app, once each. Make the coupon code first under Shop → Affiliates (it must cover that app's plans), then switch the campaign on. Preview and send a test at /api/admin/buyer-offers.",
  },
  access: { read: authenticated, update: authenticated },
  fields: [
    { name: "on", type: "checkbox", defaultValue: false, label: "Sending is on", admin: { description: "Off: nothing is sent, even by the daily job." } },
    {
      name: "dailyLimit",
      type: "number",
      min: 1,
      max: 280,
      defaultValue: 100,
      label: "Emails a day (all campaigns together)",
      admin: { description: "Brevo's free plan sends 300 a day, shared with order and sign-in emails, so keep this well under it." },
    },
    {
      type: "collapsible",
      label: "Wedding Planner Sheet buyers → Online Wedding Planner",
      fields: [
        { name: "plannerOn", type: "checkbox", defaultValue: false, label: "This campaign is on" },
        { name: "plannerCode", type: "text", label: "Coupon code", admin: { description: "e.g. SHEET500. Must exist under Shop → Affiliates and cover the planner plans." } },
        { name: "plannerOffer", type: "text", label: "What the code gives", admin: { description: "Shown in the email, e.g. ₹500 off the Family plan. Keep it exactly what the code does." } },
      ],
    },
    {
      type: "collapsible",
      label: "Workout Challenge Tracker buyers → Pandora Workout",
      fields: [
        { name: "workoutOn", type: "checkbox", defaultValue: false, label: "This campaign is on" },
        { name: "workoutCode", type: "text", label: "Coupon code", admin: { description: "e.g. TRACKER30. Must exist under Shop → Affiliates and cover the workout plans." } },
        { name: "workoutOffer", type: "text", label: "What the code gives", admin: { description: "Shown in the email, e.g. 30% off any yearly plan." } },
      ],
    },
  ],
};
