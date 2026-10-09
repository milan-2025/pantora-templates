import type { Block } from "payload";
import { FEATURE_ICONS } from "@/collections/Products";

/**
 * Page-builder blocks. Editors stack these to build any page
 * (homepage, /ultimateweddingplanner, legal pages, …) without code.
 */

const link = (prefix: string, label: string) => [
  { name: `${prefix}Label`, type: "text" as const, label: `${label} text` },
  { name: `${prefix}Url`, type: "text" as const, label: `${label} link`, admin: { description: "e.g. /wedding_planner or https://…" } },
];

export const HeroBlock: Block = {
  slug: "hero",
  labels: { singular: "Hero banner", plural: "Hero banners" },
  fields: [
    { name: "eyebrow", type: "text" },
    { name: "heading", type: "text", required: true },
    { name: "headingAccent", type: "text", admin: { description: "Optional accent part of the heading" } },
    { name: "text", type: "textarea" },
    ...link("primary", "Main button"),
    ...link("secondary", "Second button"),
    { name: "image", type: "upload", relationTo: "media" },
  ],
};

export const RichTextBlock: Block = {
  slug: "richText",
  labels: { singular: "Text", plural: "Text" },
  fields: [
    { name: "content", type: "richText", required: true },
    {
      name: "width",
      type: "select",
      defaultValue: "normal",
      options: [
        { label: "Normal (best for reading)", value: "normal" },
        { label: "Wide", value: "wide" },
      ],
    },
  ],
};

export const ImageTextBlock: Block = {
  slug: "imageText",
  labels: { singular: "Image + text", plural: "Image + text" },
  fields: [
    { name: "image", type: "upload", relationTo: "media", required: true },
    { name: "eyebrow", type: "text" },
    { name: "heading", type: "text" },
    { name: "content", type: "richText" },
    {
      name: "imageSide",
      type: "select",
      defaultValue: "left",
      options: [
        { label: "Image on the left", value: "left" },
        { label: "Image on the right", value: "right" },
      ],
    },
    ...link("button", "Button"),
  ],
};

export const FeatureGridBlock: Block = {
  slug: "featureGrid",
  labels: { singular: "Feature grid", plural: "Feature grids" },
  fields: [
    { name: "heading", type: "text" },
    { name: "text", type: "textarea" },
    {
      name: "items",
      type: "array",
      fields: [
        { name: "icon", type: "select", options: FEATURE_ICONS, defaultValue: "Gift" },
        { name: "title", type: "text", required: true },
        { name: "text", type: "textarea" },
      ],
    },
  ],
};

export const ProductCardsBlock: Block = {
  slug: "productCards",
  labels: { singular: "Product cards", plural: "Product cards" },
  fields: [
    { name: "heading", type: "text" },
    { name: "text", type: "textarea" },
    {
      name: "products",
      type: "relationship",
      relationTo: "products",
      hasMany: true,
      admin: { description: "Leave empty to show all published products" },
    },
  ],
};

export const CtaBlock: Block = {
  slug: "cta",
  labels: { singular: "Call to action banner", plural: "Call to action banners" },
  fields: [
    { name: "heading", type: "text", required: true },
    { name: "text", type: "textarea" },
    ...link("button", "Button"),
    {
      name: "style",
      type: "select",
      defaultValue: "plum",
      options: [
        { label: "Plum (dark)", value: "plum" },
        { label: "Teal", value: "teal" },
        { label: "Cream (light)", value: "cream" },
      ],
    },
  ],
};

export const FaqBlock: Block = {
  slug: "faq",
  labels: { singular: "FAQ", plural: "FAQs" },
  fields: [
    { name: "heading", type: "text", defaultValue: "Questions? We've got answers." },
    {
      name: "items",
      type: "array",
      fields: [
        { name: "question", type: "text", required: true },
        { name: "answer", type: "textarea", required: true },
      ],
    },
  ],
};

export const TestimonialsBlock: Block = {
  slug: "testimonials",
  labels: { singular: "Testimonials", plural: "Testimonials" },
  fields: [
    { name: "heading", type: "text" },
    {
      name: "items",
      type: "array",
      fields: [
        { name: "name", type: "text", required: true },
        { name: "city", type: "text" },
        { name: "text", type: "textarea", required: true },
      ],
    },
  ],
};

export const ContactFormBlock: Block = {
  slug: "contactForm",
  labels: { singular: "Contact form", plural: "Contact forms" },
  fields: [
    { name: "heading", type: "text", defaultValue: "Get in touch" },
    { name: "text", type: "textarea" },
  ],
};

export const VideoBlock: Block = {
  slug: "video",
  labels: { singular: "Video", plural: "Videos" },
  fields: [
    { name: "media", type: "upload", relationTo: "media", required: true },
    { name: "caption", type: "text" },
  ],
};

export const HtmlBlock: Block = {
  slug: "html",
  labels: { singular: "Custom HTML", plural: "Custom HTML" },
  fields: [
    {
      name: "html",
      type: "code",
      label: "HTML code",
      required: true,
      admin: {
        language: "html",
        description:
          "Paste HTML here: a small snippet or a whole page (including <style> and <script>). " +
          "Tip: for a page made entirely of your own code, also tick 'Hide site menu & footer' in the page's sidebar.",
        editorOptions: { minimap: { enabled: false }, wordWrap: "on" },
      },
    },
    {
      name: "mode",
      type: "radio",
      defaultValue: "isolated",
      options: [
        { label: "Isolated: runs exactly as pasted, styles and scripts included (best for whole pages)", value: "isolated" },
        { label: "Blend in: uses the site's fonts and styles; scripts won't run (best for small snippets, better for Google)", value: "inline" },
      ],
    },
    {
      name: "width",
      type: "select",
      defaultValue: "full",
      options: [
        { label: "Full width (edge to edge)", value: "full" },
        { label: "Centered (same width as other sections)", value: "contained" },
      ],
    },
  ],
};

export const pageBlocks = [
  HeroBlock,
  RichTextBlock,
  ImageTextBlock,
  FeatureGridBlock,
  ProductCardsBlock,
  CtaBlock,
  FaqBlock,
  TestimonialsBlock,
  ContactFormBlock,
  VideoBlock,
  HtmlBlock,
];
