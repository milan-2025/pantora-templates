/** In-memory stand-in for the Payload Local API calls the planner uses (tests only). */
/* eslint-disable @typescript-eslint/no-explicit-any -- loose test double for the Payload Local API */
import { Query } from "mingo";
type Doc = Record<string, any>;
const db: Record<string, Doc[]> = {};
const coll = (n: string) => (db[n] ??= []);
let seq = 1;
function toMongo(w: any): any {
  if (!w) return {};
  const out: any = {};
  for (const [k, v] of Object.entries<any>(w)) {
    if (k === "and") { out.$and = v.map(toMongo); continue; }
    if (k === "or") { out.$or = v.map(toMongo); continue; }
    const c: any = {};
    for (const [op, val] of Object.entries<any>(v)) {
      if (op === "equals") Object.assign(c, { $eq: val });
      else if (op === "not_equals") Object.assign(c, { $ne: val });
      else if (op === "in") c.$in = val;
      else if (op === "exists") c.$exists = val;
      else if (op === "greater_than") c.$gt = val;
      else if (op === "less_than") c.$lt = val;
      else throw new Error("op " + op);
    }
    out[k] = c;
  }
  return out;
}
const match = (n: string, where: any) => { const q = new Query(toMongo(where)); return coll(n).filter((d) => q.test(d)); };
const sortDocs = (docs: Doc[], sort?: string) => {
  if (!sort) return docs;
  const desc = sort.startsWith("-"), k = sort.replace(/^-/, "");
  return [...docs].sort((a, b) => ((a[k] ?? 0) < (b[k] ?? 0) ? -1 : (a[k] ?? 0) > (b[k] ?? 0) ? 1 : 0) * (desc ? -1 : 1));
};
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const unique: Record<string, string[]> = { "planner-plans": ["planId"], "workout-plans": ["planId"], "workout-profiles": ["email"], "workout-groups": ["code"] };
export const fakePayload: any = {
  db,
  async find({ collection, where, sort, limit = 10 }: any) {
    const docs = sortDocs(match(collection, where), sort);
    return { docs: clone(docs.slice(0, limit)), totalDocs: docs.length };
  },
  async count({ collection, where }: any) { return { totalDocs: match(collection, where).length }; },
  async findByID({ collection, id }: any) {
    const d = coll(collection).find((x) => String(x.id) === String(id));
    if (!d) throw new Error("Not Found");
    return clone(d);
  },
  async create({ collection, data }: any) {
    for (const f of unique[collection] ?? []) if (coll(collection).some((d) => d[f] === data[f])) throw new Error("dup");
    const now = new Date().toISOString();
    await new Promise((r) => setTimeout(r, 2));
    const d = { ...clone(data), id: String(seq++), createdAt: now, updatedAt: now };
    coll(collection).push(d);
    return clone(d);
  },
  async update({ collection, id, where, data }: any) {
    const targets = id != null ? coll(collection).filter((d) => String(d.id) === String(id)) : match(collection, where);
    if (id != null && !targets.length) throw new Error("Not Found");
    targets.forEach((d) => Object.assign(d, clone(data), { updatedAt: new Date().toISOString() }));
    return id != null ? clone(targets[0]) : { docs: clone(targets), errors: [] };
  },
  async delete({ collection, where }: any) {
    const ms = match(collection, where);
    db[collection] = coll(collection).filter((d) => !ms.includes(d));
    return { docs: ms };
  },
  globals: {} as Record<string, Doc>,
  async findGlobal({ slug }: any) { return this.globals[slug] ? clone(this.globals[slug]) : null; },
  async updateGlobal({ slug, data }: any) { this.globals[slug] = { ...(this.globals[slug] ?? {}), ...clone(data) }; return clone(this.globals[slug]); },
  async auth({ headers }: any) { return { user: headers.get("cookie")?.includes("admin=1") ? { id: "admin" } : null }; },
};
export const getPayloadClient = async () => fakePayload;
