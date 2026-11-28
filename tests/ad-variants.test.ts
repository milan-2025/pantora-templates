import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AD_VARIANTS, pickVariant, variantKeys } from "../lib/adVariants";
import { trackingScript, variantsFor } from "../lib/tracking";

describe("ad headline versions", () => {
  it("shows the matching headline, and the main one for unknown or missing versions", () => {
    expect(pickVariant("invites", "rsvp").key).toBe("rsvp");
    expect(pickVariant("photos", "nope").key).toBe("main");
    expect(pickVariant("hostbook", null).headline).toEqual(AD_VARIANTS.hostbook.main);
    expect(pickVariant("hostbook", "__proto__").key).toBe("main");
  });
  it("tells the Pixel script which versions a page knows", () => {
    expect(variantsFor("invites")).toBe(variantKeys("invites").join(","));
    expect(trackingScript("photos")).toContain('data-variants="main,guests,qr,albums"');
    expect(variantsFor("crm")).toBe("");
  });
  it("keeps the plain-HTML pages and apps in step with their Pixel lists", () => {
    const crm = readFileSync("public/crm-software.html", "utf8");
    expect(crm).toContain('data-variants="main,followup,team,ads,price"');
    for (const k of ["followup", "team", "ads", "price"]) expect(crm).toContain(`"${k}": {`);
    const re = readFileSync("public/real-estate-crm.html", "utf8");
    expect(re).toContain('data-variants="main,inventory,visits,partners,pages"');
    const w = readFileSync("workout-app/shell.html", "utf8");
    expect(w).toContain('data-variants="main,home,family,streak,beginner"');
    const p = readFileSync("planner-app/shell.html", "utf8");
    expect(p).toContain('data-variants="main,family,budget,guests,invite"');
  });
});
