import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { SHOP_CATEGORIES, TRACKED, trackingScript } from "../lib/tracking";

const SRC = readFileSync(new URL("../public/pt-track.js", import.meta.url), "utf8");

type Call = unknown[];

/** Runs public/pt-track.js in a tiny fake browser and records every fbq() call. */
async function runTracker(opts: { pixel: string | null; dataset?: Record<string, string>; early?: Call[] }) {
  const calls: Call[] = [];
  const listeners: Record<string, ((e: unknown) => void)[]> = {};
  const store = new Map<string, string>();
  const window: Record<string, unknown> = {};
  const document = {
    currentScript: { dataset: opts.dataset ?? {} },
    querySelector: () => null,
    createElement: () => ({}),
    getElementsByTagName: () => [{ parentNode: { insertBefore: () => undefined } }],
    addEventListener: (type: string, fn: (e: unknown) => void) => {
      (listeners[type] ??= []).push(fn);
    },
  };
  if (opts.early) window.ptq = opts.early;
  // A stand-in for Meta's fbq: records calls instead of loading Meta's script.
  window.fbq = (...args: unknown[]) => calls.push(args);
  const ctx = vm.createContext({
    window,
    document,
    sessionStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) },
    fetch: async () => ({ ok: true, json: async () => ({ id: opts.pixel }) }),
    Object,
    Array,
    Proxy,
    Reflect,
    WeakSet,
    Number,
    String,
    console,
  });
  // Browser globals are properties of window.
  Object.setPrototypeOf(window, ctx);
  vm.runInContext(`with (window) { ${SRC} }`, ctx);
  await new Promise((r) => setTimeout(r, 10));
  return { calls, window, click: (href: string) => listeners.click?.forEach((fn) => fn({ target: { closest: () => ({ getAttribute: () => href }) } })) };
}

const product = { content_ids: ["planner"], content_name: "Online Wedding Planner", content_category: "weddings", content_type: "product" };

describe("one Pixel for every app page", () => {
  it("labels every event with the product, so each product gets its own custom conversion", async () => {
    const t = await runTracker({ pixel: "1384790833822166", dataset: { id: "planner", name: "Online Wedding Planner", category: "weddings" } });
    expect(t.calls[0]).toEqual(["init", "1384790833822166"]);
    expect(t.calls[1]).toEqual(["track", "PageView"]);
    expect(t.calls[2]).toEqual(["track", "ViewContent", product, undefined]);
    (t.window.ptTrack as (e: string, p?: object) => void)("StartTrial", { value: 0, currency: "INR" });
    expect(t.calls.at(-1)).toEqual(["track", "StartTrial", { ...product, value: 0, currency: "INR" }, undefined]);
  });

  it("sends calls made before it loaded, and non-standard events as custom events", async () => {
    const t = await runTracker({ pixel: "1", dataset: { id: "planner", name: "Online Wedding Planner", category: "weddings", view: "off" }, early: [["Lead", {}], ["InviteOpen"]] });
    expect(t.calls.map((c) => c.slice(0, 2))).toEqual([["init", "1"], ["track", "PageView"], ["track", "Lead"], ["trackCustom", "InviteOpen"]]);
  });

  it("reports WhatsApp taps as Contact", async () => {
    const t = await runTracker({ pixel: "1", dataset: { id: "hostbook", name: "HostBook", category: "hospitality", view: "off" } });
    t.click("https://wa.me/918437512120?text=Hi");
    t.click("/hostbook/app");
    expect(t.calls.filter((c) => c[1] === "Contact")).toHaveLength(1);
  });

  it("reports the Razorpay window as InitiateCheckout and a paid order as Purchase, with its value", async () => {
    const t = await runTracker({ pixel: "1", dataset: { id: "planner", name: "Online Wedding Planner", category: "weddings", view: "off" } });
    let paid = false;
    // What Razorpay's checkout.js does: defines window.Razorpay.
    t.window.Razorpay = function (this: Record<string, unknown>, o: { handler: () => void }) {
      this.open = () => o.handler();
    };
    const R = t.window.Razorpay as new (o: object) => { open: () => void };
    new R({ amount: 299900, currency: "INR", order_id: "order_X", handler: () => (paid = true) }).open();
    expect(paid).toBe(true);
    const money = { ...product, value: 2999, currency: "INR" };
    expect(t.calls.filter((c) => c[0] === "track").slice(-2)).toEqual([
      ["track", "InitiateCheckout", money, { eventID: "checkout-order_X" }],
      ["track", "Purchase", money, { eventID: "purchase-order_X" }],
    ]);
  });

  it("adds the ad headline version to every event, and remembers it for the visit", async () => {
    const t = await runTracker({ pixel: "1", dataset: { id: "photos", name: "Wedding Photo Sharing", category: "weddings", variants: "main,guests,qr" } });
    expect(t.calls[2]).toEqual(["track", "ViewContent", { content_ids: ["photos"], content_name: "Wedding Photo Sharing", content_category: "weddings", content_type: "product", ad_variant: "main" }, undefined]);
  });
  it("does nothing at all when no Pixel ID is set in the admin", async () => {
    const t = await runTracker({ pixel: null, dataset: { id: "crm", name: "LeadFlow CRM", category: "business" } });
    (t.window.ptTrack as (e: string) => void)("CompleteRegistration");
    expect(t.calls).toEqual([]);
  });
});

describe("product labels", () => {
  it("gives every app and both CRM products a category", () => {
    expect(Object.keys(TRACKED)).toEqual(["planner", "invites", "photos", "workout", "hostbook", "stays", "crm", "crm-real-estate"]);
    for (const p of Object.values(TRACKED)) expect(["weddings", "self-improvement", "business", "hospitality"]).toContain(p.category);
    expect(SHOP_CATEGORIES).toEqual({ wedding_planner_sheet: "weddings", workout_challange: "self-improvement" });
  });
  it("writes the script tag for plain-HTML pages", () => {
    expect(trackingScript("invites")).toBe('<script src="/pt-track.js" data-id="invites" data-name="Wedding Invite Maker" data-category="weddings" data-variants="main,rsvp,save,cost,family" defer></script>');
    expect(trackingScript("photos", { view: false })).toContain('data-view="off"');
    expect(trackingScript("nope")).toBe("");
  });
});
