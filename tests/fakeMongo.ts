/** Minimal in-memory stand-in for the MongoDB collections the CRM API uses (tests only). */
import { Query } from "mingo";

type Doc = Record<string, any>;
const getPath = (o: any, p: string) => p.split(".").reduce((a, k) => (a == null ? undefined : a[k]), o);
const setPath = (o: any, p: string, v: any) => {
  const ks = p.split("."); let t = o;
  ks.slice(0, -1).forEach((k) => { t[k] = t[k] ?? {}; t = t[k]; });
  t[ks[ks.length - 1]] = v;
};
const unsetPath = (o: any, p: string) => {
  const ks = p.split("."); let t = o;
  for (const k of ks.slice(0, -1)) { t = t?.[k]; if (!t) return; }
  delete t[ks[ks.length - 1]];
};
const applyUpdate = (d: Doc, u: Doc) => {
  for (const [k, v] of Object.entries<any>(u.$set ?? {})) setPath(d, k, v);
  for (const k of Object.keys(u.$unset ?? {})) unsetPath(d, k);
};

class Coll {
  docs: Doc[] = [];
  uniques: string[][] = [];
  private dup(d: Doc, skip?: Doc) {
    return this.uniques.some((keys) => this.docs.some((x) => x !== skip && keys.every((k) => getPath(x, k) !== undefined && getPath(x, k) === getPath(d, k))));
  }
  private check(d: Doc, skip?: Doc) {
    if (this.dup(d, skip)) throw Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
  }
  async createIndex(spec: Doc, opts?: Doc) { if (opts?.unique) this.uniques.push(Object.keys(spec)); }
  async insertOne(d: Doc) { this.check(d); this.docs.push(structuredClone(d)); return { insertedId: d._id }; }
  async insertMany(ds: Doc[]) { for (const d of ds) { this.check(d); this.docs.push(structuredClone(d)); } return { insertedCount: ds.length }; }
  private match(q: Doc = {}) { const qq = new Query(q); return this.docs.filter((d) => qq.test(d)); }
  find(q: Doc = {}) {
    let out = this.match(q);
    const cur: any = {
      sort(s: Doc) { const ks = Object.entries<number>(s); out = [...out].sort((a, b) => { for (const [k, dir] of ks) { const x = getPath(a, k), y = getPath(b, k); if (x === y) continue; return ((x ?? "") < (y ?? "") ? -1 : 1) * dir; } return 0; }); return cur; },
      limit(n: number) { out = out.slice(0, n); return cur; },
      async toArray() { return structuredClone(out); },
    };
    return cur;
  }
  async findOne(q: Doc = {}) { const m = this.match(q)[0]; return m ? structuredClone(m) : null; }
  async countDocuments(q: Doc = {}) { return this.match(q).length; }
  async updateOne(q: Doc, u: Doc) { const m = this.match(q)[0]; if (!m) return { matchedCount: 0 }; applyUpdate(m, u); return { matchedCount: 1 }; }
  async updateMany(q: Doc, u: Doc) { const ms = this.match(q); ms.forEach((m) => applyUpdate(m, u)); return { matchedCount: ms.length }; }
  async replaceOne(q: Doc, d: Doc, o?: Doc) { const m = this.match(q)[0]; if (m) { Object.keys(m).forEach((k) => delete m[k]); Object.assign(m, structuredClone(d)); return { matchedCount: 1 }; } if (o?.upsert) this.docs.push(structuredClone(d)); return { matchedCount: 0 }; }
  async deleteOne(q: Doc) { const m = this.match(q)[0]; if (m) this.docs.splice(this.docs.indexOf(m), 1); return { deletedCount: m ? 1 : 0 }; }
  async deleteMany(q: Doc) { const ms = this.match(q); this.docs = this.docs.filter((d) => !ms.includes(d)); return { deletedCount: ms.length }; }
}

export function makeFakeDb() {
  const colls = new Map<string, Coll>();
  return { collection: (n: string) => { if (!colls.has(n)) colls.set(n, new Coll()); return colls.get(n)!; } };
}
