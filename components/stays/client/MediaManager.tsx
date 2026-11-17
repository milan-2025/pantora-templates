"use client";
/**
 * Photos and videos for one property: drag-and-drop or phone camera/gallery uploads (straight to Cloudinary),
 * bulk uploads with progress, reorder (drag, or arrows on phones), cover photo, captions, delete.
 * Hosts on a live listing: new files wait for approval and deleting becomes a removal request.
 */
import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Camera, Check, Loader2, Play, Star, Trash2, Upload, Undo2 } from "lucide-react";
import { MAX_IMAGE_MB, MAX_VIDEO_MB } from "@/lib/stays/constants";
import { api, uploadToCloud } from "./api";

export type MediaRow = { id: string; type: "image" | "video"; url: string; thumb: string; caption: string; pending: boolean; removalRequested: boolean; by: string };
type Job = { name: string; progress: number; error?: string; done?: boolean };

export function MediaManager<P>({ base, propertyId, media, coverId, onChange, live }: {
  base: "host" | "admin"; propertyId: string; media: MediaRow[]; coverId: string | null;
  onChange: (p: P) => void; live?: boolean;
}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [msg, setMsg] = useState("");
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const isHost = base === "host";

  async function call(a: string, body: Record<string, unknown>) {
    setMsg("");
    try {
      const r = await api<{ property: P }>(base, a, { id: propertyId, ...body });
      if (r.property) onChange(r.property);
      return true;
    } catch (e) {
      setMsg((e as Error).message);
      return false;
    }
  }

  async function upload(files: FileList | File[]) {
    const list = [...files];
    if (!list.length) return;
    setMsg("");
    const start = jobs.length;
    setJobs((j) => [...j, ...list.map((f) => ({ name: f.name, progress: 0 }))]);
    const upd = (i: number, p: Partial<Job>) => setJobs((j) => j.map((x, k) => (k === start + i ? { ...x, ...p } : x)));
    let next = 0;
    const worker = async () => {
      while (next < list.length) {
        const i = next++;
        const f = list[i];
        const type = f.type.startsWith("video/") ? "video" : f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name) ? "image" : null;
        if (!type) { upd(i, { error: "Not a photo or video" }); continue; }
        const max = (type === "video" ? MAX_VIDEO_MB : MAX_IMAGE_MB) * 1048576;
        if (f.size > max) { upd(i, { error: `Too large (max ${type === "video" ? MAX_VIDEO_MB : MAX_IMAGE_MB} MB)` }); continue; }
        try {
          const sign = await api<{ url: string; fields: Record<string, string> }>(base, "media_sign", { id: propertyId, type });
          const result = await uploadToCloud(sign, f, (p) => upd(i, { progress: p }));
          const r = await api<{ property: P }>(base, "media_add", { id: propertyId, upload: result });
          onChange(r.property);
          upd(i, { progress: 1, done: true });
        } catch (e) {
          upd(i, { error: (e as Error).message });
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    setTimeout(() => setJobs((j) => j.filter((x) => !x.done)), 2500);
  }

  async function move(id: string, to: number) {
    const ids = media.map((m) => m.id).filter((x) => x !== id);
    ids.splice(Math.max(0, Math.min(ids.length, to)), 0, id);
    setBusy(id);
    await call("media_order", { ids });
    setBusy(null);
  }

  return (
    <div>
      {live && isHost && <p className="mb-3 rounded-xl bg-sand px-3 py-2 text-sm text-marigold-deep">This listing is live: new photos appear once we approve them, and removals are sent to us as requests.</p>}
      <div
        onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setOver(true); } }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); setOver(false); upload(e.dataTransfer.files); } }}
        className={`rounded-2xl border-2 border-dashed p-5 text-center transition ${over ? "border-plum bg-lavender" : "border-line bg-white"}`}
      >
        <p className="text-sm text-plum"><strong>Drag photos and videos here</strong>, or</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} className="s-btn s-btn-primary s-btn-sm"><Upload className="size-4" /> Choose files</button>
          <button type="button" onClick={() => camRef.current?.click()} className="s-btn s-btn-ghost s-btn-sm sm:hidden"><Camera className="size-4" /> Take a photo</button>
        </div>
        <p className="s-hint">Photos up to {MAX_IMAGE_MB} MB, videos up to {MAX_VIDEO_MB} MB. Select many at once.</p>
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { if (e.target.files) upload(e.target.files); e.target.value = ""; }} />
        <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { if (e.target.files) upload(e.target.files); e.target.value = ""; }} />
      </div>

      {jobs.length > 0 && (
        <ul className="mt-3 space-y-1.5" aria-live="polite">
          {jobs.map((j, i) => (
            <li key={i} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-line">
              <span className="min-w-0 flex-1 truncate">{j.name}</span>
              {j.error ? <span className="text-coral">{j.error}</span> : j.done ? <Check className="size-4 text-teal" /> : (
                <span className="flex w-28 items-center gap-2"><span className="h-1.5 flex-1 overflow-hidden rounded bg-lavender"><span className="block h-full bg-plum" style={{ width: `${Math.round(j.progress * 100)}%` }} /></span><Loader2 className="size-4 animate-spin text-muted" /></span>
              )}
            </li>
          ))}
        </ul>
      )}
      {msg && <p className="mt-3 rounded-xl bg-blush px-3 py-2 text-sm text-coral" role="alert">{msg}</p>}

      {media.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No photos yet. Guests book what they can see: add at least 5 good photos (living room, bedrooms, bathroom, kitchen, view).</p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {media.map((m, i) => (
            <li
              key={m.id}
              draggable
              onDragStart={(e) => { setDrag(m.id); e.dataTransfer.effectAllowed = "move"; }}
              onDragOver={(e) => { if (drag) e.preventDefault(); }}
              onDrop={(e) => { if (drag && drag !== m.id) { e.preventDefault(); move(drag, i); } setDrag(null); }}
              onDragEnd={() => setDrag(null)}
              className={`group relative overflow-hidden rounded-xl bg-white ring-1 ${m.id === coverId ? "ring-2 ring-marigold" : "ring-line"} ${drag === m.id ? "opacity-40" : ""} ${busy === m.id ? "animate-pulse" : ""}`}
            >
              <div className="relative aspect-[4/3] bg-sand">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.thumb} alt={m.caption || ""} className="size-full object-cover" loading="lazy" />
                {m.type === "video" && <span className="absolute inset-0 grid place-items-center"><span className="grid size-10 place-items-center rounded-full bg-white/90 text-plum"><Play className="size-4 fill-current" /></span></span>}
                <div className="absolute left-1.5 top-1.5 flex flex-wrap gap-1">
                  {m.id === coverId && <span className="rounded-full bg-marigold px-2 py-0.5 text-[11px] font-semibold text-plum">Cover</span>}
                  {m.pending && <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-marigold-deep">Awaiting approval</span>}
                  {m.removalRequested && <span className="rounded-full bg-coral px-2 py-0.5 text-[11px] font-semibold text-white">Removal requested</span>}
                </div>
              </div>
              <div className="p-2">
                <input
                  defaultValue={m.caption}
                  placeholder="Caption (optional)"
                  aria-label="Caption"
                  className="w-full rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-xs hover:border-line focus:border-plum focus:outline-none"
                  onBlur={(e) => { if (e.target.value !== m.caption) call("media_caption", { mediaId: m.id, caption: e.target.value }); }}
                />
                <div className="mt-1 flex items-center justify-between gap-1">
                  <div className="flex">
                    <button type="button" className="rounded-lg p-1.5 text-muted hover:bg-plum/5 hover:text-plum disabled:opacity-30" disabled={i === 0} onClick={() => move(m.id, i - 1)} aria-label="Move earlier"><ArrowUp className="size-4" /></button>
                    <button type="button" className="rounded-lg p-1.5 text-muted hover:bg-plum/5 hover:text-plum disabled:opacity-30" disabled={i === media.length - 1} onClick={() => move(m.id, i + 1)} aria-label="Move later"><ArrowDown className="size-4" /></button>
                    {m.type === "image" && m.id !== coverId && !m.pending && (
                      <button type="button" className="rounded-lg p-1.5 text-muted hover:bg-plum/5 hover:text-marigold-deep" onClick={() => call("media_cover", { mediaId: m.id })} aria-label="Make cover photo" title="Make cover photo"><Star className="size-4" /></button>
                    )}
                  </div>
                  <div className="flex">
                    {!isHost && m.pending && <button type="button" className="rounded-lg px-2 py-1 text-xs font-semibold text-teal hover:bg-mint" onClick={() => call("media_approve", { mediaId: m.id })}>Approve</button>}
                    {!isHost && m.removalRequested && <button type="button" className="rounded-lg p-1.5 text-muted hover:bg-plum/5" onClick={() => call("media_keep", { mediaId: m.id })} aria-label="Keep it" title="Keep (decline removal)"><Undo2 className="size-4" /></button>}
                    {!(isHost && m.removalRequested) && (
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-muted hover:bg-blush hover:text-coral"
                        onClick={() => { if (confirm(isHost && live && !m.pending ? "Ask us to remove this from the live listing?" : "Delete this file permanently?")) call("media_remove", { mediaId: m.id }); }}
                        aria-label={isHost && live && !m.pending ? "Request removal" : "Delete"}
                      ><Trash2 className="size-4" /></button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {!isHost && media.some((m) => m.pending) && (
        <button type="button" onClick={() => call("media_approve", { mediaId: "all" })} className="s-btn s-btn-accent s-btn-sm mt-3">Approve all new uploads</button>
      )}
    </div>
  );
}
