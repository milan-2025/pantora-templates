"use client";
/** Photo gallery (grid on desktop, swipe on phones) with a full-screen viewer, and the video list. */
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Images, Play, X } from "lucide-react";

type Photo = { id: string; src: string; thumb: string; srcSet?: string; caption: string; width: number | null; height: number | null };
type Video = { id: string; src: string; thumb: string; poster?: string; caption: string };

export function Gallery({ photos, title }: { photos: Photo[]; title: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!photos.length) return <div className="grid aspect-[16/9] place-items-center rounded-3xl bg-sand text-plum/50">Photos coming soon</div>;
  const main = photos[0];
  const side = photos.slice(1, 5);
  return (
    <>
      {/* phones: swipe */}
      <div className="s-scroll-x -mx-4 flex snap-x snap-mandatory gap-2 px-4 sm:hidden">
        {photos.map((p, i) => (
          <button key={p.id} type="button" onClick={() => setOpen(i)} className="relative aspect-[4/3] w-[88%] shrink-0 snap-center overflow-hidden rounded-2xl bg-sand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.src} srcSet={p.srcSet} sizes="88vw" alt={p.caption || `${title} photo ${i + 1}`} loading={i < 2 ? "eager" : "lazy"} className="size-full object-cover" />
            <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-xs text-white">{i + 1}/{photos.length}</span>
          </button>
        ))}
      </div>
      {/* tablet/desktop: grid */}
      <div className={`relative hidden gap-2 overflow-hidden rounded-3xl sm:grid ${side.length ? "aspect-[2.1/1] grid-cols-4 grid-rows-2" : "aspect-[16/8]"}`}>
        <button type="button" onClick={() => setOpen(0)} className={`relative overflow-hidden bg-sand ${side.length ? "col-span-2 row-span-2" : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={main.src} srcSet={main.srcSet} sizes="(min-width: 1024px) 640px, 50vw" alt={main.caption || title} className="size-full object-cover transition hover:brightness-95" />
        </button>
        {side.map((p, i) => (
          <button key={p.id} type="button" onClick={() => setOpen(i + 1)} className={`relative overflow-hidden bg-sand ${side.length === 1 ? "col-span-2 row-span-2" : side.length === 2 ? "col-span-2" : side.length === 3 && i === 2 ? "col-span-2" : ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.thumb} srcSet={p.srcSet} sizes="25vw" alt={p.caption || `${title} photo ${i + 2}`} loading="lazy" className="size-full object-cover transition hover:brightness-95" />
          </button>
        ))}
        {photos.length > 1 && (
          <button type="button" onClick={() => setOpen(0)} className="s-btn s-btn-ghost s-btn-sm absolute bottom-4 right-4 !bg-white"><Images className="size-4" /> Show all {photos.length} photos</button>
        )}
      </div>
      {open !== null && <Viewer photos={photos} start={open} title={title} onClose={() => setOpen(null)} />}
    </>
  );
}

function Viewer({ photos, start, title, onClose }: { photos: Photo[]; start: number; title: string; onClose: () => void }) {
  const [i, setI] = useState(start);
  const dlg = useRef<HTMLDialogElement>(null);
  const touch = useRef<number | null>(null);
  const go = useCallback((d: number) => setI((x) => (x + d + photos.length) % photos.length), [photos.length]);
  useEffect(() => {
    if (dlg.current && !dlg.current.open) dlg.current.showModal();
    const key = (e: KeyboardEvent) => { if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [go]);
  const p = photos[i];
  return (
    <dialog ref={dlg} onClose={onClose} className="m-0 h-dvh max-h-none w-screen max-w-none bg-black/95 p-0 text-white backdrop:bg-black">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between p-3">
          <span className="text-sm text-white/80">{i + 1} / {photos.length}</span>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-white/10" aria-label="Close"><X className="size-6" /></button>
        </div>
        <div className="relative flex min-h-0 flex-1 items-center justify-center px-2"
          onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => { if (touch.current === null) return; const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); touch.current = null; }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={p.id} src={p.src} alt={p.caption || `${title} photo ${i + 1}`} className="max-h-full max-w-full object-contain" />
          {photos.length > 1 && (
            <>
              <button type="button" onClick={() => go(-1)} className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/15 p-3 hover:bg-white/25 sm:block" aria-label="Previous photo"><ChevronLeft /></button>
              <button type="button" onClick={() => go(1)} className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/15 p-3 hover:bg-white/25 sm:block" aria-label="Next photo"><ChevronRight /></button>
            </>
          )}
        </div>
        <p className="min-h-12 p-3 text-center text-sm text-white/85">{p.caption}</p>
      </div>
    </dialog>
  );
}

export function Videos({ videos }: { videos: Video[] }) {
  const [playing, setPlaying] = useState<string | null>(null);
  if (!videos.length) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {videos.map((v) => (
        <figure key={v.id} className="overflow-hidden rounded-2xl bg-black">
          {playing === v.id ? (
            <video src={v.src} poster={v.poster} controls autoPlay playsInline className="aspect-video w-full bg-black" />
          ) : (
            <button type="button" onClick={() => setPlaying(v.id)} className="group relative block aspect-video w-full" aria-label={`Play video${v.caption ? `: ${v.caption}` : ""}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={v.poster || v.thumb} alt="" loading="lazy" className="size-full object-cover opacity-90 transition group-hover:opacity-100" />
              <span className="absolute inset-0 grid place-items-center"><span className="grid size-14 place-items-center rounded-full bg-white/90 text-plum shadow-lift"><Play className="ml-0.5 size-6 fill-current" /></span></span>
            </button>
          )}
          {v.caption && <figcaption className="bg-paper px-3 py-2 text-sm text-charcoal">{v.caption}</figcaption>}
        </figure>
      ))}
    </div>
  );
}

export function ShareButton({ title, url }: { title: string; url?: string }) {
  const [done, setDone] = useState(false);
  async function share() {
    const href = url || location.href;
    try {
      if (navigator.share) { await navigator.share({ title, url: href }); return; }
      await navigator.clipboard.writeText(href);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch { /* cancelled */ }
  }
  return <button type="button" onClick={share} className="s-btn s-btn-ghost s-btn-sm">{done ? "Link copied" : "Share"}</button>;
}

/** A row of photos (e.g. one room's) that opens the full-screen viewer. */
export function PhotoStrip({ photos, title }: { photos: Photo[]; title: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!photos.length) return null;
  return (
    <>
      <div className="s-scroll-x -mx-1 flex gap-2 px-1">
        {photos.map((p, i) => (
          <button key={p.id} type="button" onClick={() => setOpen(i)} className="relative aspect-[4/3] w-44 shrink-0 overflow-hidden rounded-xl bg-sand sm:w-56" aria-label={p.caption || `${title} photo ${i + 1}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.thumb} alt={p.caption || ""} loading="lazy" className="size-full object-cover transition hover:brightness-95" />
            {p.caption && <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 to-transparent px-2 pb-1 pt-4 text-left text-xs text-white">{p.caption}</span>}
          </button>
        ))}
      </div>
      {open !== null && <Viewer photos={photos} start={open} title={title} onClose={() => setOpen(null)} />}
    </>
  );
}
