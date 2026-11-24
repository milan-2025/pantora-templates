import type { CollectionConfig } from "payload";
import { authenticated, nobody } from "@/lib/cms/access";

/** One photo or video in a gallery. The files themselves are in photo storage (R2); this is the record of them. */
export const PhotoItems: CollectionConfig = {
  slug: "photo-items",
  labels: { singular: "Photo / video", plural: "Photos & videos" },
  admin: {
    group: "Wedding photos",
    useAsTitle: "name",
    defaultColumns: ["name", "gallery", "kind", "album", "status", "by", "createdAt"],
    description: "Every uploaded photo and video. Couples manage these from their gallery dashboard; delete them there so the files are removed too.",
  },
  defaultSort: "-createdAt",
  access: { read: authenticated, create: nobody, update: authenticated, delete: nobody },
  fields: [
    { name: "gallery", type: "relationship", relationTo: "photo-galleries", required: true, index: true },
    {
      type: "row",
      fields: [
        { name: "kind", type: "select", required: true, defaultValue: "photo", options: ["photo", "video"], admin: { width: "25%" } },
        { name: "album", type: "text", index: true, admin: { width: "25%" } },
        {
          name: "status",
          type: "select",
          defaultValue: "pending",
          index: true,
          options: [
            { label: "Uploading", value: "pending" },
            { label: "Ready", value: "ready" },
            { label: "Waiting for the couple's OK (guest photo)", value: "review" },
            { label: "Hidden", value: "hidden" },
          ],
          admin: { width: "25%" },
        },
        { name: "by", type: "select", defaultValue: "couple", options: ["couple", "guest"], admin: { width: "25%" } },
      ],
    },
    { name: "name", type: "text", label: "File name" },
    { name: "guestName", type: "text" },
    { name: "base", type: "text", required: true, index: true, admin: { description: "Storage folder: g/<gallery>/<random>" } },
    { name: "files", type: "json", admin: { description: "Which files exist: d = display, t = thumbnail, o = original, v = video, with sizes." } },
    {
      type: "row",
      fields: [
        { name: "width", type: "number", admin: { width: "20%" } },
        { name: "height", type: "number", admin: { width: "20%" } },
        { name: "bytes", type: "number", admin: { width: "20%" } },
        { name: "duration", type: "number", label: "Seconds (video)", admin: { width: "20%" } },
        { name: "takenAt", type: "date", admin: { width: "20%" } },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "bunnyGuid", type: "text", admin: { width: "50%", readOnly: true } },
        { name: "bunnyState", type: "select", options: ["sent", "ready", "failed"], admin: { width: "50%", readOnly: true } },
      ],
    },
  ],
};
