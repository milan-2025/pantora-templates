/** Shared helpers for end-to-end API tests (real handler, in-memory database). */
import { NextRequest } from "next/server";
import { expect } from "vitest";
import { makeFakeDb } from "./fakeMongo";

export const fake = makeFakeDb();
export const mockDb = async () => ({ db: { connection: { db: fake } } });

process.env.PAYLOAD_SECRET = "test-secret";
process.env.CRM_SUPERADMINS = "boss@platform.in";

let route: any;
let ipN = 100;
export const loadRoute = async () => (route = await import("../app/api/crm/route"));

export type Sess = { cookie: string; email: string };
export async function call(r: string, opts: { method?: string; body?: unknown; cookie?: string; query?: string; ip?: string } = {}) {
  const req = new NextRequest(`http://localhost/api/crm?r=${r}${opts.query || ""}`, {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    headers: { "x-forwarded-for": opts.ip ?? `10.1.0.${++ipN}`, ...(opts.cookie ? { cookie: opts.cookie } : {}) },
  });
  const res = await (req.method === "POST" ? route.POST(req) : route.GET(req));
  return { status: res.status as number, json: (await res.json().catch(() => ({}))) as any, setCookie: (res.headers.get("set-cookie") || "") as string };
}
export async function signup(company: string, email: string): Promise<Sess> {
  const r = await call("signup", { body: { company, name: "Owner " + company, email, password: "password123" } });
  expect(r.status).toBe(200);
  return { cookie: r.setCookie.split(";")[0], email };
}
export async function addUser(admin: Sess, name: string, email: string, role: string, extra: Record<string, unknown> = {}): Promise<Sess> {
  const r = await as(admin).post("user_save", { name, email, role, password: "password123", ...extra });
  expect(r.status).toBe(200);
  const l = await call("login", { body: { email, password: "password123" } });
  expect(l.status).toBe(200);
  return { cookie: l.setCookie.split(";")[0], email };
}
export const as = (s: Sess) => ({
  get: (r: string, query?: string) => call(r, { cookie: s.cookie, query }),
  post: (r: string, body: unknown, query?: string) => call(r, { cookie: s.cookie, body, query }),
});
export const NOW = "2026-11-12T10:00";
