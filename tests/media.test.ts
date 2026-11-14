import { describe, expect, it } from "vitest";
import { cleanDocName, cleanVideos, docFolder, docInFolder, embedUrl, youTubeId } from "../lib/crm/media";

describe("YouTube links", () => {
  const id = "dQw4w9WgXcQ";
  it("reads the video id from the usual link styles", () => {
    for (const u of [
      `https://www.youtube.com/watch?v=${id}`, `https://youtube.com/watch?v=${id}&t=42s`, `https://m.youtube.com/watch?v=${id}`,
      `https://youtu.be/${id}`, `https://youtu.be/${id}?si=abc`, `https://www.youtube.com/shorts/${id}`,
      `https://www.youtube.com/embed/${id}`, `https://www.youtube.com/live/${id}`, `https://www.youtube-nocookie.com/embed/${id}`, `http://youtu.be/${id}`,
    ]) expect(youTubeId(u), u).toBe(id);
  });
  it("rejects anything else", () => {
    for (const u of [
      "https://vimeo.com/123", `https://evil.com/watch?v=${id}`, `https://youtube.com.evil.io/watch?v=${id}`, "https://www.youtube.com/watch?v=short",
      "https://www.youtube.com/@channel", "javascript:alert(1)", `https://youtu.be/${id}"onload="x`, "", null,
    ]) expect(youTubeId(u), String(u)).toBe("");
  });
  it("cleans a list to unique canonical links, up to 10", () => {
    expect(cleanVideos(`https://youtu.be/${id}\nhttps://www.youtube.com/watch?v=${id}\nhttps://vimeo.com/1`)).toEqual([`https://www.youtube.com/watch?v=${id}`]);
    const many = Array.from({ length: 15 }, (_, i) => `https://youtu.be/${String(i).padStart(11, "a")}`);
    expect(cleanVideos(many)).toHaveLength(10);
    expect(cleanVideos(undefined)).toEqual([]);
  });
  it("builds a no-cookie embed only for valid ids", () => {
    expect(embedUrl(id)).toBe(`https://www.youtube-nocookie.com/embed/${id}?rel=0`);
    expect(embedUrl("bad\"id")).toBe("");
  });
});

describe("documents", () => {
  it("keeps allowed file types with a readable name", () => {
    expect(cleanDocName("Allotment letter.PDF")).toBe("Allotment letter.PDF");
    expect(cleanDocName("../../etc/pass<wd>.pdf")).toBe(".. .. etc pass wd .pdf");
    for (const n of ["script.exe", "noext", ".pdf", "", "a.html"]) expect(cleanDocName(n), n).toBe("");
  });
  it("only accepts files inside the unit's own folder", () => {
    const f = docFolder("ws1", "u1");
    expect(f).toBe("crm/ws1/units/u1/docs");
    expect(docInFolder(`${f}/agreement_ab12.pdf`, "ws1", "u1")).toBe(true);
    for (const p of [`crm/ws2/units/u1/docs/a.pdf`, `crm/ws1/units/u2/docs/a.pdf`, `${f}/../../u2/docs/a.pdf`, `${f}`, `${f}/a b.pdf`, "", undefined])
      expect(docInFolder(p, "ws1", "u1"), String(p)).toBe(false);
  });
});
