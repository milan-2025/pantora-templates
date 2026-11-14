import { describe, expect, it } from "vitest";
import { cleanImages, cleanMapUrl, codeNumber, formatCode, isCode, leadInProject, resolveProject } from "../lib/crm/property";

describe("Property IDs", () => {
  it("formats and recognises codes", () => {
    expect(formatCode(1)).toBe("PR-001");
    expect(formatCode(42)).toBe("PR-042");
    expect(formatCode(1234)).toBe("PR-1234");
    expect(isCode("PR-007")).toBe(true);
    for (const s of ["PR-7", "pr-007", "X-001", "", null]) expect(isCode(s)).toBe(false);
  });
  it("sorts naturally", () => {
    const codes = ["PR-010", "PR-002", "", "PR-1000", "PR-100"];
    expect([...codes].sort((a, b) => codeNumber(a) - codeNumber(b))).toEqual(["PR-002", "PR-010", "PR-100", "PR-1000", ""]);
  });
});

describe("images", () => {
  it("keeps unique https links, up to 12", () => {
    const many = Array.from({ length: 20 }, (_, i) => `https://res.cloudinary.com/x/image/upload/${i}.jpg`);
    expect(cleanImages(many)).toHaveLength(12);
    expect(cleanImages(["https://a.com/1.jpg", "https://a.com/1.jpg", "http://a.com/2.jpg", "javascript:alert(1)", "data:image/png;base64,x"])).toEqual(["https://a.com/1.jpg"]);
    expect(cleanImages("https://a.com/1.jpg\nhttps://a.com/2.jpg")).toEqual(["https://a.com/1.jpg", "https://a.com/2.jpg"]);
    expect(cleanImages(undefined)).toEqual([]);
  });
});

describe("Google Maps links", () => {
  it("accepts the usual share links", () => {
    for (const u of [
      "https://maps.app.goo.gl/AbC123xyz",
      "https://www.google.com/maps/place/Sunrise+Heights/@18.5,73.8,17z",
      "https://google.co.in/maps?q=18.5,73.8",
      "https://maps.google.com/?q=Baner",
      "https://goo.gl/maps/abc",
    ]) expect(cleanMapUrl(u), u).toBe(new URL(u).toString());
  });
  it("rejects anything that is not Google Maps", () => {
    for (const u of [
      "http://maps.app.goo.gl/x", "https://evil.com/maps", "https://www.google.com/search?q=x", "https://maps.app.goo.gl.evil.com/x",
      "https://goo.gl/abc", "javascript:alert(1)", "https://google.com.evil.io/maps", "",
    ]) expect(cleanMapUrl(u), u).toBe("");
  });
});

describe("linking leads to projects", () => {
  const ps = [{ id: "p1", name: "Sunrise Heights" }, { id: "p2", name: "Green Acres" }];
  it("prefers a valid id, then a matching name, else keeps the typed name", () => {
    expect(resolveProject(ps, { projectId: "p2", project: "Sunrise Heights" })).toEqual({ projectId: "p2", project: "Green Acres" });
    expect(resolveProject(ps, { project: "  sunrise heights " })).toEqual({ projectId: "p1", project: "Sunrise Heights" });
    expect(resolveProject(ps, { projectId: "other-company", project: "Somewhere" })).toEqual({ projectId: "", project: "Somewhere" });
    expect(resolveProject(ps, {})).toEqual({ projectId: "", project: "" });
  });
  it("matches leads by id, or by name for older leads", () => {
    expect(leadInProject({ projectId: "p1" }, ps[0])).toBe(true);
    expect(leadInProject({ projectId: "p2", project: "Sunrise Heights" }, ps[0])).toBe(false);
    expect(leadInProject({ project: "SUNRISE HEIGHTS" }, ps[0])).toBe(true);
    expect(leadInProject({}, ps[0])).toBe(false);
  });
});
