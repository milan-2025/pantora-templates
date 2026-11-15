import "server-only";
import { NextResponse } from "next/server";
import { PlannerError } from "./core";

type Ctx = { params: Promise<Record<string, string>> };

/** Wraps a planner API route: PlannerError → JSON error with its status; anything else → 500. */
export function route(fn: (req: Request, params: Record<string, string>) => Promise<unknown>) {
  return async (req: Request, ctx: Ctx) => {
    try {
      const out = await fn(req, (await ctx?.params) ?? {});
      return out instanceof Response ? out : NextResponse.json(out, { headers: { "cache-control": "no-store" } });
    } catch (e) {
      if (e instanceof PlannerError) return NextResponse.json({ error: e.message, ...e.extra }, { status: e.status });
      console.error("[planner-api]", e);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  };
}

export const body = async (req: Request) => {
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") throw new PlannerError("Invalid request");
  return b as Record<string, unknown>;
};
