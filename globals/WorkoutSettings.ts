import type { GlobalConfig } from "payload";
import { authenticated } from "@/lib/cms/access";
import { DEFAULT_MILESTONES, DEFAULT_MONEYBACK } from "@/lib/workout/core";

/** Everything about the workout app that isn't a plan: free challenge, groups, buddy, gifts, money-back, referrals, codes. */
export const WorkoutSettings: GlobalConfig = {
  slug: "workout-settings",
  label: "Workout app settings",
  admin: { group: "Workout app", description: "Changes apply within a minute. Prices, friends and photos a week are set per plan under Workout plans." },
  access: { read: authenticated, update: authenticated },
  fields: [
    {
      type: "collapsible",
      label: "Free challenge, groups & buddy",
      fields: [
        {
          type: "row",
          fields: [
            { name: "freeDays", type: "number", min: 1, defaultValue: 14, label: "Free challenge (days)", admin: { width: "25%" } },
            { name: "groupMax", type: "number", min: 2, defaultValue: 10, label: "People in a group (max)", admin: { width: "25%" } },
            { name: "groupsPerPerson", type: "number", min: 1, defaultValue: 5, label: "Groups one person can be in", admin: { width: "25%" } },
            { name: "waAfterDays", type: "number", min: 0, defaultValue: 7, label: "Buddies can swap WhatsApp after (days)", admin: { width: "25%" } },
          ],
        },
        { name: "buddyOn", type: "checkbox", defaultValue: true, label: "Random accountability buddy is on (paid members only)" },
      ],
    },
    {
      type: "collapsible",
      label: "Milestone gifts",
      fields: [
        {
          name: "milestones",
          type: "array",
          defaultValue: DEFAULT_MILESTONES,
          admin: { description: "Unlocked automatically. Days only count when logged on the day (or the next day). Free days extend the plan (or the free challenge); a seat lets one more friend join the buyer's plan; a coupon shows the code you type here." },
          fields: [
            {
              type: "row",
              fields: [
                { name: "key", type: "text", required: true, admin: { width: "20%", description: "Unique, never change" } },
                { name: "title", type: "text", required: true, admin: { width: "30%" } },
                { name: "kind", type: "select", defaultValue: "streak", options: [{ label: "Days in a row", value: "streak" }, { label: "Complete days in total", value: "total" }], admin: { width: "25%" } },
                { name: "days", type: "number", required: true, min: 1, admin: { width: "25%" } },
              ],
            },
            {
              type: "row",
              fields: [
                { name: "reward", type: "select", defaultValue: "days", options: [{ label: "Free days", value: "days" }, { label: "Streak freeze", value: "freeze" }, { label: "Coupon code", value: "coupon" }, { label: "Badge only", value: "badge" }, { label: "Extra friend seat", value: "seat" }], admin: { width: "25%" } },
                { name: "amount", type: "number", min: 0, admin: { width: "15%", description: "Days / freezes / seats" } },
                { name: "code", type: "text", label: "Coupon code", admin: { width: "20%" } },
                { name: "note", type: "text", label: "What they see", admin: { width: "30%" } },
                { name: "active", type: "checkbox", defaultValue: true, admin: { width: "10%" } },
              ],
            },
          ],
        },
      ],
    },
    {
      type: "collapsible",
      label: "Money-back promise",
      fields: [
        {
          type: "row",
          fields: [
            { name: "moneyBackOn", type: "checkbox", defaultValue: true, label: "Show and allow claims", admin: { width: "40%" } },
            { name: "moneyBackRule", type: "select", defaultValue: "logged", label: "A day counts when", options: [{ label: "They log a workout or check-in that day", value: "logged" }, { label: "They complete the day (workout + checkpoints)", value: "completed" }], admin: { width: "60%" } },
          ],
        },
        {
          name: "moneyBackTiers",
          type: "array",
          defaultValue: DEFAULT_MONEYBACK,
          admin: { description: "Within one paid year. The buyer picks money back OR free months. Only the buyer (not friends on their plan) can claim." },
          fields: [{ type: "row", fields: [{ name: "days", type: "number", required: true, min: 1, label: "Days counted", admin: { width: "34%" } }, { name: "percent", type: "number", min: 0, max: 100, label: "% money back", admin: { width: "33%" } }, { name: "months", type: "number", min: 0, label: "or free months", admin: { width: "33%" } }] }],
        },
        { name: "moneyBackTerms", type: "textarea", defaultValue: "Days count only when logged on the day itself (or by the next day). One claim per paid year, by the buyer. We check claims by hand and pay refunds to the original payment method within 7 working days. Payments made with a promo code are refunded on the amount actually paid." },
      ],
    },
    {
      type: "collapsible",
      label: "Pledge: money on finishing a challenge",
      fields: [
        {
          type: "row",
          fields: [
            { name: "pledgeOn", type: "checkbox", defaultValue: false, label: "Offer pledges in the app", admin: { width: "40%", description: "Off until you've filled in the charity and terms." } },
            { name: "pledgeNeed", type: "number", min: 50, max: 100, defaultValue: 80, label: "Complete days needed (%)", admin: { width: "30%" } },
            { name: "pledgeMinDays", type: "number", min: 7, defaultValue: 14, label: "Shortest challenge for a pledge (days)", admin: { width: "30%" } },
          ],
        },
        { name: "pledgeAmounts", type: "text", defaultValue: "199, 499, 999", label: "Amounts to choose from (₹, comma-separated)" },
        { name: "pledgeCharity", type: "text", label: "Where missed pledges go", admin: { placeholder: "e.g. Akshaya Patra Foundation (mid-day meals)" } },
        {
          name: "pledgeTerms",
          type: "textarea",
          defaultValue:
            "You pay the amount before the pledge starts. Complete days count only when logged on the day (or by the next day). Hit the target and we refund the full amount to your original payment method within 7 working days of the challenge ending. Miss it and we give the full amount to the charity named here. Pledges can't be cancelled once paid.",
        },
      ],
    },
    {
      type: "collapsible",
      label: "Referrals",
      fields: [
        {
          type: "row",
          fields: [
            { name: "refOn", type: "checkbox", defaultValue: true, label: "Referral links on", admin: { width: "25%" } },
            { name: "refFriendOff", type: "number", min: 0, defaultValue: 100, label: "Friend gets ₹ off", admin: { width: "25%" } },
            { name: "refReward", type: "select", defaultValue: "days", label: "You get", options: [{ label: "Free days", value: "days" }, { label: "Extra friend seat", value: "seat" }], admin: { width: "25%" } },
            { name: "refAmount", type: "number", min: 0, defaultValue: 30, label: "How many", admin: { width: "25%" } },
          ],
        },
        { name: "refMax", type: "number", min: 0, defaultValue: 12, label: "Most rewards one person can earn (0 = no limit)" },
      ],
    },
    {
      type: "collapsible",
      label: "Promo codes & page",
      fields: [
        { name: "offerText", type: "text", label: "Offer line on the page (optional)" },
        {
          type: "row",
          fields: [
            { name: "whatsappNumber", type: "text", label: "WhatsApp number for questions", admin: { width: "50%", placeholder: "e.g. 918437512120" } },
            { name: "whatsappMessage", type: "text", defaultValue: "Hi! I have a question about the Pandora workout app.", admin: { width: "50%" } },
          ],
        },
        {
          name: "promoCodes",
          type: "array",
          fields: [{ type: "row", fields: [{ name: "code", type: "text", required: true, admin: { width: "30%" } }, { name: "amountOff", type: "number", min: 0, label: "₹ off", admin: { width: "20%" } }, { name: "validUntil", type: "date", admin: { width: "30%" } }, { name: "active", type: "checkbox", defaultValue: true, admin: { width: "20%" } }] }],
        },
      ],
    },
    { name: "vapidPublic", type: "text", admin: { hidden: true } },
    { name: "vapidPrivate", type: "text", admin: { hidden: true } },
  ],
};
