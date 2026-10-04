import type { Field, GlobalConfig } from "payload";
import { anyone, authenticated } from "@/lib/cms/access";
import { revalidateEverything } from "@/lib/cms/revalidate";

const linkFields: Field[] = [
  { name: "label", type: "text", required: true },
  { name: "url", type: "text", required: true },
];

export const SiteSettings: GlobalConfig = {
  slug: "site-settings",
  label: "Site settings",
  admin: { group: "Settings" },
  access: { read: anyone, update: authenticated },
  hooks: { afterChange: [revalidateEverything] },
  fields: [
    {
      type: "tabs",
      tabs: [
        {
          label: "Brand & contact",
          fields: [
            { name: "brandName", type: "text", defaultValue: "Pandora Templates" },
            {
              name: "tagline",
              type: "text",
              defaultValue: "Beautifully designed, ready-to-use templates for life's big projects.",
            },
            {
              name: "whatsappNumber",
              type: "text",
              admin: { description: "With country code, digits only, e.g. 918437512120" },
            },
            { name: "whatsappMessage", type: "text", admin: { description: "Pre-filled WhatsApp message" } },
            { name: "instagramUrl", type: "text" },
            { name: "supportEmail", type: "email" },
          ],
        },
        {
          label: "Menu & footer",
          fields: [
            { name: "navLinks", type: "array", labels: { singular: "Menu link", plural: "Menu links" }, fields: linkFields },
            {
              name: "navCta",
              type: "group",
              label: "Menu button",
              fields: [
                { name: "label", type: "text", defaultValue: "Shop templates" },
                { name: "url", type: "text", defaultValue: "/#products" },
              ],
            },
            {
              name: "footerLinks",
              type: "array",
              labels: { singular: "Footer link", plural: "Footer links" },
              fields: linkFields,
            },
          ],
        },
        {
          label: "Tracking",
          fields: [
            {
              name: "metaPixelId",
              type: "text",
              admin: { description: "Meta (Instagram/Facebook) Pixel ID for ad tracking" },
            },
          ],
        },
      ],
    },
  ],
};
