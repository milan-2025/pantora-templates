import type { CollectionConfig } from "payload";
import { authenticated, nobody } from "@/lib/cms/access";

/*
 * Workout app (/workout). Everything lives under "Workout app" in /admin.
 * - Workout plans: the free challenge and the yearly plans (price, friends, photos a week).
 * - Memberships: one per buyer. The buyer shares it with friends/family (members).
 * - People: one per email. Their own challenge and logs, gifts, buddy and per-person overrides.
 * - Groups, Messages, Progress photos, Money-back claims.
 */

const group = "Workout app";
const lower = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : v);

type BeforeChange = NonNullable<NonNullable<CollectionConfig["hooks"]>["beforeChange"]>[number];
type AfterChange = NonNullable<NonNullable<CollectionConfig["hooks"]>["afterChange"]>[number];
const relId = (v: unknown) => (v && typeof v === "object" ? String((v as { id?: unknown }).id ?? "") : v ? String(v) : "");

export const WorkoutPlans: CollectionConfig = {
  slug: "workout-plans",
  labels: { singular: "Workout plan", plural: "Workout plans" },
  admin: {
    group,
    useAsTitle: "name",
    defaultColumns: ["name", "isFree", "price", "durationDays", "seats", "photosPerWeek", "active"],
    description: "The free challenge and the paid plans. Changes apply at once to everyone on the plan. Exactly one plan should be ticked as free.",
  },
  defaultSort: "sortOrder",
  access: { read: authenticated, create: authenticated, update: authenticated, delete: authenticated },
  fields: [
    {
      type: "row",
      fields: [
        { name: "name", type: "text", required: true, admin: { width: "40%" } },
        { name: "planId", type: "text", required: true, unique: true, index: true, label: "Plan code", admin: { width: "30%", description: "E.g. basic. Don't change it once sold." } },
        { name: "sortOrder", type: "number", defaultValue: 10, admin: { width: "30%" } },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "isFree", type: "checkbox", label: "This is the free challenge", defaultValue: false },
        { name: "active", type: "checkbox", label: "Show on the upgrade screen", defaultValue: true },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "price", type: "number", min: 0, defaultValue: 0, label: "Price (₹, incl. GST)", admin: { width: "25%" } },
        { name: "durationDays", type: "number", min: 1, defaultValue: 365, label: "Valid for (days)", admin: { width: "25%", description: "Length of the free challenge for the free plan (e.g. 14)." } },
        { name: "seats", type: "number", min: 0, defaultValue: 3, label: "Friends/family included", admin: { width: "25%", description: "People the buyer can add on their plan, besides themselves." } },
        { name: "photosPerWeek", type: "number", min: 0, defaultValue: 1, label: "Progress photos a week", admin: { width: "25%", description: "Per person. Unused photos don't carry over." } },
      ],
    },
    { name: "tagline", type: "text" },
    { name: "badge", type: "text", admin: { description: "E.g. “Best value”." } },
    { name: "features", type: "array", label: "What's included (one line each)", fields: [{ name: "text", type: "text", required: true }] },
  ],
};

/** Changing the plan in /admin without typing a date gives a full year (the plan's length) from today. */
const membershipAdmin: BeforeChange = async ({ data, originalDoc, req, operation }) => {
  if (!data) return data;
  if (typeof data.ownerEmail === "string") data.ownerEmail = lower(data.ownerEmail);
  if (Array.isArray(data.members)) data.members = (data.members as { email?: string }[]).map((m) => ({ ...m, email: lower(m.email ?? "") }));
  const newPlan = relId(data.plan), oldPlan = relId(originalDoc?.plan);
  if (!newPlan || newPlan === oldPlan) return data;
  const typed = operation === "create" ? Boolean(data.expiresAt) : data.expiresAt !== undefined && data.expiresAt !== (originalDoc?.expiresAt ?? null);
  const plan = await req.payload.findByID({ collection: "workout-plans" as never, id: newPlan, depth: 0, overrideAccess: true }).catch(() => null) as { durationDays?: number } | null;
  if (plan && !typed) data.expiresAt = new Date(Date.now() + (plan.durationDays ?? 365) * 864e5).toISOString();
  if (!data.termStart && !originalDoc?.termStart) data.termStart = new Date().toISOString();
  return data;
};

export const WorkoutMemberships: CollectionConfig = {
  slug: "workout-memberships",
  labels: { singular: "Membership", plural: "Memberships" },
  admin: {
    group,
    useAsTitle: "ownerEmail",
    defaultColumns: ["ownerEmail", "plan", "status", "expiresAt", "amount", "paidAt"],
    listSearchableFields: ["ownerEmail", "orderId"],
    description: "One per buyer. The buyer adds friends/family as members, who then use the app on this plan. Change the plan or type a new date to extend.",
  },
  defaultSort: "-createdAt",
  access: { read: authenticated, create: authenticated, update: authenticated, delete: authenticated },
  hooks: { beforeChange: [membershipAdmin] },
  fields: [
    { name: "ownerEmail", type: "email", required: true, index: true, label: "Buyer email" },
    {
      type: "row",
      fields: [
        { name: "plan", type: "relationship", relationTo: "workout-plans" as never, required: true, admin: { width: "34%" } },
        { name: "status", type: "select", defaultValue: "active", index: true, options: [{ label: "Active", value: "active" }, { label: "Suspended", value: "suspended" }], admin: { width: "33%" } },
        { name: "expiresAt", type: "date", label: "Valid until", admin: { width: "33%", date: { pickerAppearance: "dayAndTime" } } },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "paidAt", type: "date", admin: { width: "25%" } },
        { name: "amount", type: "number", label: "Amount received (₹)", admin: { width: "25%" } },
        { name: "termStart", type: "date", label: "Money-back year starts", admin: { width: "25%", description: "Days for money-back are counted from here." } },
        { name: "promoCode", type: "text", admin: { width: "25%", readOnly: true } },
      ],
    },
    {
      type: "collapsible",
      label: "Limits for this buyer (leave empty to use the plan's)",
      admin: { initCollapsed: true },
      fields: [
        {
          type: "row",
          fields: [
            { name: "seatsOverride", type: "number", min: 0, label: "Friends/family allowed", admin: { width: "33%", placeholder: "Plan's number" } },
            { name: "photosOverride", type: "number", min: 0, label: "Photos a week (each person)", admin: { width: "33%", placeholder: "Plan's number" } },
            { name: "extraSeats", type: "number", min: 0, defaultValue: 0, label: "Extra friends earned", admin: { width: "33%", description: "From gifts and referrals. Added on top." } },
          ],
        },
      ],
    },
    {
      name: "members",
      type: "array",
      labels: { singular: "Member", plural: "Friends & family on this plan" },
      fields: [
        {
          type: "row",
          fields: [
            { name: "email", type: "email", required: true },
            { name: "name", type: "text" },
            { name: "addedAt", type: "date", admin: { readOnly: true } },
          ],
        },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "referredBy", type: "text", label: "Referral code used", admin: { width: "50%", readOnly: true } },
        { name: "referralRewarded", type: "checkbox", label: "Referrer rewarded", admin: { width: "50%", readOnly: true } },
      ],
    },
    { name: "adminNote", type: "textarea", label: "Admin note" },
    {
      type: "collapsible",
      label: "Payment details",
      admin: { initCollapsed: true },
      fields: [
        { name: "orderId", type: "text", index: true, admin: { readOnly: true } },
        { name: "paymentId", type: "text", admin: { readOnly: true } },
        { name: "orderPlan", type: "relationship", relationTo: "workout-plans" as never, admin: { readOnly: true } },
        { name: "orderAmount", type: "number", admin: { readOnly: true } },
        { name: "orderPaid", type: "checkbox", admin: { readOnly: true } },
        { name: "orderRef", type: "text", admin: { readOnly: true } },
      ],
    },
  ],
};

export const WorkoutProfiles: CollectionConfig = {
  slug: "workout-profiles",
  labels: { singular: "Person", plural: "People" },
  admin: {
    group,
    useAsTitle: "email",
    defaultColumns: ["email", "name", "program", "streak", "lastActivityAt", "buddyStatus"],
    listSearchableFields: ["email", "name", "refCode"],
    description: "Everyone who signed in: their challenge, logs, gifts and buddy. Set per-person photo limits or free days here.",
  },
  defaultSort: "-lastActivityAt",
  access: { read: authenticated, create: authenticated, update: authenticated, delete: authenticated },
  hooks: { beforeChange: [({ data }) => { if (data && typeof data.email === "string") data.email = lower(data.email); return data; }] },
  fields: [
    {
      type: "row",
      fields: [
        { name: "email", type: "email", required: true, unique: true, index: true, admin: { width: "40%" } },
        { name: "name", type: "text", admin: { width: "30%" } },
        { name: "phone", type: "text", label: "WhatsApp number", admin: { width: "30%" } },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "program", type: "text", label: "Current challenge", admin: { width: "34%", readOnly: true } },
        { name: "streak", type: "number", label: "Streak (on-time days)", admin: { width: "33%", readOnly: true } },
        { name: "lastActivityAt", type: "date", admin: { width: "33%", readOnly: true } },
      ],
    },
    {
      type: "collapsible",
      label: "Free challenge & overrides",
      admin: { initCollapsed: true },
      fields: [
        {
          type: "row",
          fields: [
            { name: "freeStart", type: "date", label: "Free challenge started", admin: { width: "25%" } },
            { name: "freeDaysOverride", type: "number", min: 0, label: "Free days (override)", admin: { width: "25%", placeholder: "From settings" } },
            { name: "bonusDays", type: "number", min: 0, defaultValue: 0, label: "Bonus days earned", admin: { width: "25%", description: "Gifts/referrals not yet used on a plan. Added to their free days, or to a plan they buy." } },
            { name: "photosOverride", type: "number", min: 0, label: "Photos a week (override)", admin: { width: "25%", placeholder: "From plan" } },
          ],
        },
        {
          type: "row",
          fields: [
            { name: "bonusFreezes", type: "number", min: 0, defaultValue: 0, label: "Bonus streak freezes", admin: { width: "50%" } },
            { name: "bonusSeats", type: "number", min: 0, defaultValue: 0, label: "Bonus friend seats", admin: { width: "50%", description: "Earned before buying: added to their plan when they buy." } },
          ],
        },
      ],
    },
    {
      type: "collapsible",
      label: "Referrals",
      admin: { initCollapsed: true },
      fields: [
        {
          type: "row",
          fields: [
            { name: "refCode", type: "text", unique: true, index: true, label: "Their referral code", admin: { width: "34%" } },
            { name: "referredBy", type: "text", label: "Came from code", admin: { width: "33%", readOnly: true } },
            { name: "refCount", type: "number", defaultValue: 0, label: "Paid referrals", admin: { width: "33%", readOnly: true } },
          ],
        },
        { name: "source", type: "text", label: "Came from (ad/link)", admin: { readOnly: true } },
      ],
    },
    {
      type: "collapsible",
      label: "Accountability buddy",
      admin: { initCollapsed: true },
      fields: [
        {
          type: "row",
          fields: [
            { name: "buddyStatus", type: "select", defaultValue: "none", index: true, options: [{ label: "None", value: "none" }, { label: "Waiting for a match", value: "waiting" }, { label: "Matched", value: "matched" }], admin: { width: "25%" } },
            { name: "buddyEmail", type: "text", index: true, admin: { width: "35%" } },
            { name: "buddySince", type: "date", admin: { width: "20%" } },
            { name: "buddyShareWa", type: "checkbox", label: "Agreed to share WhatsApp", admin: { width: "20%" } },
          ],
        },
        { name: "buddyWaitingSince", type: "date", index: true, admin: { readOnly: true } },
        { name: "buddyBlocked", type: "json", label: "Won't be matched again with", admin: { readOnly: true } },
        { name: "reports", type: "number", defaultValue: 0, label: "Times reported by a buddy", admin: { readOnly: true } },
      ],
    },
    {
      type: "collapsible",
      label: "Gifts unlocked",
      admin: { initCollapsed: true },
      fields: [
        {
          name: "rewards",
          type: "array",
          fields: [
            {
              type: "row",
              fields: [
                { name: "key", type: "text", admin: { width: "20%" } },
                { name: "title", type: "text", admin: { width: "30%" } },
                { name: "note", type: "text", admin: { width: "30%" } },
                { name: "at", type: "date", admin: { width: "20%" } },
              ],
            },
            { type: "row", fields: [{ name: "reward", type: "text", admin: { width: "34%" } }, { name: "amount", type: "number", admin: { width: "33%" } }, { name: "code", type: "text", admin: { width: "33%" } }] },
          ],
        },
      ],
    },
    { name: "reminderHour", type: "number", min: 0, max: 23, label: "Reminder hour (India time)", admin: { readOnly: true } },
    { name: "rev", type: "number", defaultValue: 0, admin: { readOnly: true } },
    { name: "adminNote", type: "textarea" },
    { name: "state", type: "json", admin: { description: "Their logs. Edit with care.", readOnly: true } },
    { name: "logged", type: "json", admin: { readOnly: true, description: "Days logged on time (count for money-back)." } },
    { name: "completed", type: "json", admin: { readOnly: true, description: "Complete days logged on time (count for gifts)." } },
    { name: "push", type: "json", admin: { hidden: true } },
    { name: "orderId", type: "text", index: true, admin: { hidden: true } },
    { name: "order", type: "json", admin: { hidden: true } },
  ],
};

export const WorkoutGroups: CollectionConfig = {
  slug: "workout-groups",
  labels: { singular: "Group", plural: "Groups" },
  admin: { group, useAsTitle: "name", defaultColumns: ["name", "ownerEmail", "mode", "start", "createdAt"], listSearchableFields: ["name", "ownerEmail", "code"] },
  defaultSort: "-createdAt",
  access: { read: authenticated, create: authenticated, update: authenticated, delete: authenticated },
  fields: [
    { type: "row", fields: [{ name: "name", type: "text", required: true, admin: { width: "50%" } }, { name: "code", type: "text", required: true, unique: true, index: true, label: "Invite code", admin: { width: "25%" } }, { name: "maxOverride", type: "number", min: 2, label: "Max people (override)", admin: { width: "25%" } }] },
    { type: "row", fields: [{ name: "ownerEmail", type: "email", required: true, index: true, admin: { width: "40%" } }, { name: "mode", type: "select", defaultValue: "together", options: [{ label: "Same challenge together", value: "together" }, { label: "Just log together", value: "log" }], admin: { width: "30%" } }, { name: "start", type: "text", admin: { width: "30%" } }] },
    { type: "row", fields: [{ name: "program", type: "text", admin: { width: "50%" } }, { name: "length", type: "number", admin: { width: "50%" } }] },
    { name: "members", type: "array", fields: [{ type: "row", fields: [{ name: "email", type: "email", required: true }, { name: "name", type: "text" }, { name: "joinedAt", type: "date" }] }] },
  ],
};

export const WorkoutFeed: CollectionConfig = {
  slug: "workout-feed",
  labels: { singular: "Message", plural: "Messages (cheers & nudges)" },
  admin: { group, defaultColumns: ["fromName", "kind", "text", "toEmail", "groupCode", "createdAt"], hidden: false },
  defaultSort: "-createdAt",
  access: { read: authenticated, create: nobody, update: authenticated, delete: authenticated },
  fields: [
    { type: "row", fields: [{ name: "kind", type: "select", options: ["cheer", "nudge", "msg", "event"].map((v) => ({ label: v, value: v })), admin: { width: "25%" } }, { name: "groupCode", type: "text", index: true, admin: { width: "25%" } }, { name: "toEmail", type: "text", index: true, admin: { width: "25%" } }, { name: "fromEmail", type: "text", admin: { width: "25%" } }] },
    { type: "row", fields: [{ name: "fromName", type: "text", admin: { width: "30%" } }, { name: "text", type: "text", admin: { width: "70%" } }] },
  ],
};

export const WorkoutPhotos: CollectionConfig = {
  slug: "workout-photos",
  labels: { singular: "Progress photo", plural: "Progress photos" },
  admin: { group, defaultColumns: ["email", "week", "status", "createdAt"], listSearchableFields: ["email"], description: "Kept private: only the person sees them in the app." },
  defaultSort: "-createdAt",
  access: { read: authenticated, create: nobody, update: authenticated, delete: authenticated },
  fields: [
    { type: "row", fields: [{ name: "email", type: "text", required: true, index: true, admin: { width: "40%" } }, { name: "week", type: "text", index: true, admin: { width: "20%" } }, { name: "day", type: "text", admin: { width: "20%" } }, { name: "status", type: "select", defaultValue: "pending", options: [{ label: "Uploading", value: "pending" }, { label: "Saved", value: "ready" }], admin: { width: "20%" } }] },
    { name: "publicId", type: "text", required: true, admin: { readOnly: true } },
    { name: "note", type: "text" },
  ],
};

/** Approving a claim where the person chose free months extends their membership at once. */
const claimApproved: AfterChange = async ({ doc, previousDoc, req }) => {
  if (doc.status !== "approved" || previousDoc?.status === "approved" || doc.choice !== "extend") return doc;
  const id = relId(doc.membership);
  const m = (await req.payload.findByID({ collection: "workout-memberships" as never, id, depth: 0, overrideAccess: true }).catch(() => null)) as { expiresAt?: string } | null;
  if (!m) return doc;
  const from = Math.max(Date.now(), m.expiresAt ? new Date(m.expiresAt).getTime() : 0);
  const until = new Date(from);
  until.setMonth(until.getMonth() + (Number(doc.months) || 0));
  await req.payload.update({ collection: "workout-memberships" as never, id, data: { expiresAt: until.toISOString() } as never, overrideAccess: true });
  await req.payload.update({ collection: "workout-claims" as never, id: doc.id, data: { status: "done", adminNote: `${doc.adminNote ? doc.adminNote + "\n" : ""}Extended to ${until.toDateString()}` } as never, overrideAccess: true });
  return doc;
};

export const WorkoutClaims: CollectionConfig = {
  slug: "workout-claims",
  labels: { singular: "Money-back claim", plural: "Money-back claims" },
  admin: {
    group,
    useAsTitle: "email",
    defaultColumns: ["email", "counted", "choice", "percent", "refundAmount", "status", "createdAt"],
    description:
      "Claims from buyers who reached the days needed. Check their log, then: for money back, refund in the Razorpay dashboard and set Status to Paid. For free months, set Status to Approved and the membership is extended automatically.",
  },
  defaultSort: "-createdAt",
  access: { read: authenticated, create: nobody, update: authenticated, delete: authenticated },
  hooks: { afterChange: [claimApproved] },
  fields: [
    { type: "row", fields: [{ name: "email", type: "text", required: true, index: true, admin: { width: "40%", readOnly: true } }, { name: "membership", type: "relationship", relationTo: "workout-memberships" as never, admin: { width: "30%", readOnly: true } }, { name: "counted", type: "number", label: "Days counted", admin: { width: "30%", readOnly: true } }] },
    { type: "row", fields: [{ name: "choice", type: "select", options: [{ label: "Money back", value: "refund" }, { label: "Free months", value: "extend" }], admin: { width: "25%", readOnly: true } }, { name: "percent", type: "number", label: "% back", admin: { width: "25%", readOnly: true } }, { name: "months", type: "number", label: "Free months", admin: { width: "25%", readOnly: true } }, { name: "refundAmount", type: "number", label: "Refund (₹)", admin: { width: "25%", readOnly: true } }] },
    { type: "row", fields: [{ name: "termStart", type: "text", admin: { width: "33%", readOnly: true } }, { name: "termEnd", type: "text", admin: { width: "33%", readOnly: true } }, { name: "paymentId", type: "text", label: "Razorpay payment", admin: { width: "34%", readOnly: true } }] },
    {
      name: "status",
      type: "select",
      defaultValue: "pending",
      index: true,
      options: [
        { label: "Waiting for review", value: "pending" },
        { label: "Approved (free months: extends now)", value: "approved" },
        { label: "Refund paid", value: "paid" },
        { label: "Done (extended)", value: "done" },
        { label: "Rejected", value: "rejected" },
      ],
    },
    { name: "adminNote", type: "textarea", admin: { description: "Shown to the person if you reject the claim." } },
  ],
};

export const WorkoutLogins: CollectionConfig = {
  slug: "workout-logins",
  admin: { hidden: true },
  access: { read: nobody, create: nobody, update: nobody, delete: nobody },
  fields: [
    { name: "email", type: "text", required: true, index: true },
    { name: "codeHash", type: "text", required: true },
    { name: "expiresAt", type: "date", required: true },
    { name: "attempts", type: "number", defaultValue: 0 },
  ],
};

export const WORKOUT_COLLECTIONS = [WorkoutPlans, WorkoutMemberships, WorkoutProfiles, WorkoutGroups, WorkoutFeed, WorkoutPhotos, WorkoutClaims, WorkoutLogins];
