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

import { codeKey, compareCodes, formatUnitCode, isUnitCode, reservedCodes, unitLabel } from "../lib/crm/property";

describe("unit IDs", () => {
  it("formats and recognises unit IDs", () => {
    expect(formatUnitCode("PR-001", 7)).toBe("PR-001-U007");
    expect(formatUnitCode("PR-012", 1234)).toBe("PR-012-U1234");
    expect(isUnitCode("PR-001-U007")).toBe(true);
    for (const s of ["PR-001", "PR-001-7", "U007", "", null]) expect(isUnitCode(s)).toBe(false);
  });
  it("reserves consecutive codes for a batch", () => {
    expect(reservedCodes("PR-002", 5, 3)).toEqual(["PR-002-U003", "PR-002-U004", "PR-002-U005"]);
    expect(reservedCodes("PR-002", 1, 1)).toEqual(["PR-002-U001"]);
  });
  it("sorts by property, then unit, with gaps last", () => {
    const items = [
      { p: "PR-002", u: "PR-002-U001" }, { p: "PR-001", u: "PR-001-U010" }, { p: "PR-001", u: "" },
      { p: "PR-001", u: "PR-001-U002" }, { p: "", u: "" },
    ];
    expect(items.sort((a, b) => compareCodes(codeKey(a.p, a.u), codeKey(b.p, b.u))).map((x) => x.u || x.p || "-"))
      .toEqual(["PR-001-U002", "PR-001-U010", "PR-001", "PR-002-U001", "-"]);
  });
  it("builds the label shown on leads", () => {
    expect(unitLabel({ tower: "A", no: "A-101" })).toBe("A A-101");
    expect(unitLabel({ no: "12" })).toBe("12");
  });
});

import { projectPhotoId } from "../lib/crm/property";

describe("project photo ids (for clean-up on delete)", () => {
  it("only matches photos inside this project's own folder", () => {
    const u = "https://res.cloudinary.com/demo/image/upload/v1794915220/crm/ws1/projects/p1/abc123.jpg";
    expect(projectPhotoId(u, "ws1", "p1")).toBe("crm/ws1/projects/p1/abc123");
    expect(projectPhotoId(u.replace("/v1794915220", ""), "ws1", "p1")).toBe("crm/ws1/projects/p1/abc123");
    for (const [x, ws, p] of [[u, "ws2", "p1"], [u, "ws1", "p2"], ["https://example.com/a.jpg", "ws1", "p1"], ["https://res.cloudinary.com/demo/image/upload/v1/shaadi/x.jpg", "ws1", "p1"], ["https://res.cloudinary.com/demo/image/upload/v1/crm/ws1/projects/p1/../../x.jpg", "ws1", "p1"], ["", "ws1", "p1"]])
      expect(projectPhotoId(x, ws, p), x).toBe("");
  });
});
