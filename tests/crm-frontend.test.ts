/**
 * The CRM screens are plain browser scripts, so a single syntax slip (for example `await` inside a
 * non-async function) silently breaks the whole app with "Could not reach the server".
 * These tests parse every script the browser will run so such mistakes fail in CI instead.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

const dir = path.join(__dirname, "..", "public", "CRM");

function inlineScripts(html: string) {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
}

describe("CRM browser scripts parse without errors", () => {
  it("shim.js", () => {
    expect(() => new vm.Script(readFileSync(path.join(dir, "shim.js"), "utf8"), { filename: "shim.js" })).not.toThrow();
  });
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".html"))) {
    it(f, () => {
      const scripts = inlineScripts(readFileSync(path.join(dir, f), "utf8"));
      scripts.forEach((code, i) => expect(() => new vm.Script(code, { filename: `${f}#${i}` })).not.toThrow());
    });
  }
});
