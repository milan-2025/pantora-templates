import { describe, expect, it } from "vitest";
import { cleanPinned } from "../lib/crm/notes";

describe("cleanPinned", () => {
  it("keeps text, author and times", () => {
    expect(cleanPinned({ x: " Wants east facing ", by: "Asha", t: 5 }, 9)).toEqual({ x: "Wants east facing", by: "Asha", t: 5 });
    expect(cleanPinned({ x: "a", by: "Asha", t: 5, eby: "Ravi", et: 7 }, 9)).toEqual({ x: "a", by: "Asha", t: 5, eby: "Ravi", et: 7 });
  });
  it("removes the pin when the text is empty or the value is junk", () => {
    for (const v of [null, undefined, "", "text", [], { x: "   " }, 5]) expect(cleanPinned(v)).toBeNull();
  });
  it("limits lengths, drops extra fields and fixes bad times", () => {
    const p = cleanPinned({ x: "y".repeat(5000), by: "b".repeat(200), t: "soon", $where: "x", other: 1 }, 42)!;
    expect(p.x).toHaveLength(2000);
    expect(p.by).toHaveLength(80);
    expect(p.t).toBe(42);
    expect(Object.keys(p).sort()).toEqual(["by", "t", "x"]);
  });
});
