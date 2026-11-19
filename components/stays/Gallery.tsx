"use client";
/**
 * Photos, Airbnb-style:
 * - Gallery: the property's photos in YOUR order (cover first). Phones: full-width swipe carousel with arrows and a
 *   counter. Larger screens: one big photo + four, and "Show all photos".
 * - PhotoTour: opening the photos shows them room by room (room thumbnails at the top, then each room with its
 *   description, amenities and photos; untagged photos last). Tapping a photo opens the full-screen Viewer.
 * - RoomCards: a sideways-scrolling row of rooms; tapping one opens the tour at that room.
 * - CardCarousel: swipeable photos on property cards (arrows on hover, dots).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Grid2x2, Play, X } from "lucide-react";

export type Photo = { id: string; src: string; thumb: string; srcSet?: string; caption: string; width: number | null; height: number | null; roomId?: string | null; room?: string };
type Video = { id: string; src: string; thumb: string; poster?: string; caption: string };
export type RoomInfo = { id: string; name: string; description: string; amenities: string[] };
type Group = { id: string; name: string; description: string; amenities: string[]; photos: Photo[] };

/** Photos grouped room by room (rooms in your room-list order), then "Additional photos". */
function groupsOf(photos: Photo[], rooms: RoomInfo[]): Group[] {
  const out: Group[] = rooms.map((r) => ({ ...r, photos: photos.filter((p) => p.roomId === r.id) })).filter((g) => g.photos.length);
  const known = new Set(rooms.map((r) => r.id));
  const rest = photos.filter((p) => !p.roomId || !known.has(p.roomId));
  if (rest.length) out.push({ id: "_other", name: out.length ? "Additional photos" : "All photos", description: "", amenities: [], photos: rest });
  return out;
}

/** Index of the slide in view, and a function to move by whole slides. */
function useSlides(count: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = () => setI(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    el.addEventListener("scroll", on, { passive: true });
    return () => el.removeEventListener("scroll", on);
  }, []);
  const go = useCallback((d: number) => {
    const el = ref.current;
    if (!el) return;
    const next = Math.max(0, Math.min(count - 1, Math.round(el.scrollLeft / el.clientWidth) + d));
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  }, [count]);
  return { ref, i, go };
}

const Arrow = ({ dir, onClick, className = "", label }: { dir: "l" | "r"; onClick: (e: React.MouseEvent) => void; className?: string; label: string }) => (
  <button type="button" onClick={onClick} aria-label={label} className={`grid size-8 place-items-center rounded-full bg-white/95 text-charcoal shadow-[0_1px_4px_rgb(0_0_0/0.25)] transition hover:scale-105 ${className}`}>
    {dir === "l" ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
  </button>
);

export function Gallery({ photos, rooms = [], title }: { photos: Photo[]; rooms?: RoomInfo[]; title: string }) {
  const [tour, setTour] = useState<{ photoId?: string } | null>(null);
  const { ref, i, go } = useSlides(photos.length);
  if (!photos.length) return <div className="grid aspect-[16/9] place-items-center rounded-2xl bg-neutral-100 text-muted">Photos coming soon</div>;
  const side = photos.slice(1, 5);
  const open = (photoId?: string) => setTour({ photoId });
  return (
    <>
      {/* phones: full-width swipe carousel with arrows */}
      <div className="relative -mx-4 sm:hidden">
        <div ref={ref} className="s-scroll-x flex snap-x snap-mandatory">
          {photos.map((p, k) => (
            <button key={p.id} type="button" onClick={() => open(p.id)} className="relative aspect-[4/3] w-full shrink-0 snap-center snap-always bg-neutral-100" aria-label={`Open photos (${k + 1} of ${photos.length})`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.src} srcSet={p.srcSet} sizes="100vw" alt={p.caption || p.room || `${title} photo ${k + 1}`} loading={k < 2 ? "eager" : "lazy"} className="size-full object-cover" />
            </button>
          ))}
        </div>
        {i > 0 && <Arrow dir="l" label="Previous photo" onClick={() => go(-1)} className="absolute left-3 top-1/2 -translate-y-1/2" />}
        {i < photos.length - 1 && <Arrow dir="r" label="Next photo" onClick={() => go(1)} className="absolute right-3 top-1/2 -translate-y-1/2" />}
        <span className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-black/60 px-2 py-0.5 text-xs font-medium text-white">{i + 1} / {photos.length}</span>
      </div>
      {/* tablet/desktop: one large + four */}
      <div className={`relative hidden gap-2 overflow-hidden rounded-2xl sm:grid ${side.length ? "aspect-[2.1/1] grid-cols-4 grid-rows-2" : "aspect-[16/8]"}`}>
        <button type="button" onClick={() => open(photos[0].id)} className={`relative overflow-hidden bg-neutral-100 ${side.length ? "col-span-2 row-span-2" : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[0].src} srcSet={photos[0].srcSet} sizes="(min-width: 1024px) 640px, 50vw" alt={photos[0].caption || title} className="size-full object-cover transition hover:brightness-90" />
        </button>
        {side.map((p, k) => (
          <button key={p.id} type="button" onClick={() => open(p.id)} className={`relative overflow-hidden bg-neutral-100 ${side.length === 1 ? "col-span-2 row-span-2" : side.length === 2 ? "col-span-2" : side.length === 3 && k === 2 ? "col-span-2" : ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.thumb} srcSet={p.srcSet} sizes="25vw" alt={p.caption || p.room || `${title} photo ${k + 2}`} loading="lazy" className="size-full object-cover transition hover:brightness-90" />
          </button>
        ))}
        <button type="button" onClick={() => open()} className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-lg border border-charcoal bg-white px-3 py-1.5 text-sm font-semibold text-charcoal hover:bg-neutral-50">
          <Grid2x2 className="size-4" /> Show all photos
        </button>
      </div>
      {tour && <PhotoTour photos={photos} rooms={rooms} title={title} startPhoto={tour.photoId} onClose={() => setTour(null)} />}
    </>
  );
}

/** Full-screen room-wise view of all photos. */
export function PhotoTour({ photos, rooms, title, startPhoto, startRoom, onClose }: { photos: Photo[]; rooms: RoomInfo[]; title: string; startPhoto?: string; startRoom?: string; onClose: () => void }) {
  const groups = useMemo(() => groupsOf(photos, rooms), [photos, rooms]);
  const ordered = useMemo(() => groups.flatMap((g) => g.photos), [groups]);
  const [view, setView] = useState<number | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const jump = (id: string) => body.current?.querySelector(`[data-room="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  useEffect(() => {
    if (dlg.current && !dlg.current.open) dlg.current.showModal();
    document.documentElement.classList.add("overflow-hidden"); // stop the page behind from scrolling
    const target = startRoom || (startPhoto ? groups.find((g) => g.photos.some((p) => p.id === startPhoto))?.id : undefined);
    if (target && groups.length > 1) requestAnimationFrame(() => body.current?.querySelector(`[data-room="${target}"]`)?.scrollIntoView({ block: "start" }));
    return () => document.documentElement.classList.remove("overflow-hidden");
  }, [groups, startPhoto, startRoom]);
  return (
    <dialog ref={dlg} onClose={onClose} onCancel={onClose} className="m-0 h-dvh max-h-none w-screen max-w-none bg-white p-0 text-charcoal backdrop:bg-white" aria-label="Photo tour">
      <div ref={body} className="h-full overflow-y-auto">
        <div className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-line bg-white/95 px-3 backdrop-blur sm:px-6">
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-neutral-100" aria-label="Close photo tour"><ChevronLeft className="size-5" /></button>
          <p className="truncate px-2 text-sm font-semibold">{title}</p>
          <span className="w-9" />
        </div>
        <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6">
          <h2 className="font-display text-2xl text-charcoal sm:text-3xl">Photo tour</h2>
          {groups.length > 1 && (
            <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6">
              {groups.map((g) => (
                <button key={g.id} type="button" onClick={() => jump(g.id)} className="group text-left">
                  <span className="block aspect-[4/3] overflow-hidden rounded-xl bg-neutral-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g.photos[0].thumb} alt="" loading="lazy" className="size-full object-cover transition group-hover:brightness-90" />
                  </span>
                  <span className="mt-1.5 block truncate text-sm font-medium">{g.name}</span>
                </button>
              ))}
            </div>
          )}
          <div className="mt-8 space-y-14">
            {groups.map((g) => (
              <section key={g.id} data-room={g.id} className="scroll-mt-20 sm:grid sm:grid-cols-[14rem_1fr] sm:gap-8">
                <div className="mb-4 sm:sticky sm:top-20 sm:self-start">
                  <h3 className="font-sans text-xl font-semibold text-charcoal">{g.name}</h3>
                  {g.description && <p className="mt-1 text-sm text-muted">{g.description}</p>}
                  {g.amenities.length > 0 && <ul className="mt-2 space-y-1 text-sm">{g.amenities.map((a) => <li key={a} className="flex items-center gap-1.5"><Check className="size-3.5 text-teal" aria-hidden />{a}</li>)}</ul>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {g.photos.map((p, k) => (
                    <button key={p.id} type="button" onClick={() => setView(ordered.indexOf(p))} className={`overflow-hidden bg-neutral-100 ${k % 3 === 0 ? "col-span-2 aspect-[3/2]" : "aspect-square"}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={k % 3 === 0 ? p.src : p.thumb} srcSet={p.srcSet} sizes={k % 3 === 0 ? "(min-width: 1024px) 720px, 100vw" : "(min-width: 1024px) 360px, 50vw"} alt={p.caption || g.name} loading="lazy" className="size-full object-cover transition hover:brightness-90" />
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
      {view !== null && <Viewer photos={ordered} start={view} title={title} onClose={() => setView(null)} />}
    </dialog>
  );
}

/** Full-screen single-photo viewer: arrows, swipe, keyboard; shows the room name and position. */
function Viewer({ photos, start, title, onClose }: { photos: Photo[]; start: number; title: string; onClose: () => void }) {
  const [i, setI] = useState(start);
  const dlg = useRef<HTMLDialogElement>(null);
  const touch = useRef<number | null>(null);
  const go = useCallback((d: number) => setI((x) => Math.max(0, Math.min(photos.length - 1, x + d))), [photos.length]);
  useEffect(() => {
    if (dlg.current && !dlg.current.open) dlg.current.showModal();
    const key = (e: KeyboardEvent) => { if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [go]);
  const p = photos[i];
  const inRoom = photos.filter((x) => (x.room || "") === (p.room || ""));
  return (
    <dialog ref={dlg} onClose={onClose} onCancel={(e) => { e.preventDefault(); onClose(); }} className="m-0 h-dvh max-h-none w-screen max-w-none bg-black p-0 text-white backdrop:bg-black">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 p-3">
          <button type="button" onClick={onClose} className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-sm hover:bg-white/10" aria-label="Close"><X className="size-5" /> Close</button>
          <span className="truncate text-sm text-white/85">{p.room ? `${p.room} · ${inRoom.indexOf(p) + 1}/${inRoom.length}` : `${i + 1} / ${photos.length}`}</span>
          <span className="w-16 text-right text-xs text-white/60">{i + 1}/{photos.length}</span>
        </div>
        <div className="relative flex min-h-0 flex-1 items-center justify-center px-2"
          onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => { if (touch.current === null) return; const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); touch.current = null; }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={p.id} src={p.src} srcSet={p.srcSet} sizes="100vw" alt={p.caption || p.room || `${title} photo ${i + 1}`} className="max-h-full max-w-full object-contain" />
          {i > 0 && <button type="button" onClick={() => go(-1)} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/40 bg-black/30 p-2.5 hover:bg-white/15" aria-label="Previous photo"><ChevronLeft /></button>}
          {i < photos.length - 1 && <button type="button" onClick={() => go(1)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/40 bg-black/30 p-2.5 hover:bg-white/15" aria-label="Next photo"><ChevronRight /></button>}
        </div>
        <p className="min-h-12 p-3 text-center text-sm text-white/85">{p.caption}</p>
      </div>
    </dialog>
  );
}

/** "Room by room": sideways-scrolling room cards (swipe or arrows); tapping one opens the photo tour there. */
export function RoomCards({ photos, rooms, title }: { photos: Photo[]; rooms: RoomInfo[]; title: string }) {
  const [tour, setTour] = useState<string | null>(null);
  const row = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ l: true, r: false });
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const on = () => setEdge({ l: el.scrollLeft < 8, r: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
    on();
    el.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { el.removeEventListener("scroll", on); window.removeEventListener("resize", on); };
  }, []);
  const by = (d: number) => row.current?.scrollBy({ left: d * (row.current.clientWidth * 0.8), behavior: "smooth" });
  if (!rooms.length) return null;
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="h-rbr" className="font-display text-2xl">Room by room</h2>
        <div className="hidden gap-2 sm:flex">
          <button type="button" onClick={() => by(-1)} disabled={edge.l} className="grid size-8 place-items-center rounded-full border border-line bg-white disabled:opacity-30" aria-label="Scroll rooms left"><ChevronLeft className="size-4" /></button>
          <button type="button" onClick={() => by(1)} disabled={edge.r} className="grid size-8 place-items-center rounded-full border border-line bg-white disabled:opacity-30" aria-label="Scroll rooms right"><ChevronRight className="size-4" /></button>
        </div>
      </div>
      <div ref={row} className="s-scroll-x -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 px-4 sm:mx-0 sm:scroll-px-0 sm:px-0">
        {rooms.map((r) => {
          const pics = photos.filter((p) => p.roomId === r.id);
          return (
            <button key={r.id} type="button" onClick={() => setTour(r.id)} className="group w-[72%] shrink-0 snap-start text-left sm:w-64" disabled={!pics.length && !r.description}>
              <span className="relative block aspect-[4/3] overflow-hidden rounded-xl bg-neutral-100">
                {pics[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pics[0].thumb} alt="" loading="lazy" className="size-full object-cover transition group-hover:brightness-90" />
                )}
                {pics.length > 1 && <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] text-white">{pics.length} photos</span>}
              </span>
              <span className="mt-2 block font-semibold text-charcoal">{r.name}</span>
              {r.description && <span className="mt-0.5 line-clamp-2 block text-sm text-muted">{r.description}</span>}
              {r.amenities.length > 0 && <span className="mt-1 line-clamp-1 block text-xs text-muted">{r.amenities.join(" · ")}</span>}
            </button>
          );
        })}
      </div>
      {tour && <PhotoTour photos={photos} rooms={rooms} title={title} startRoom={tour} onClose={() => setTour(null)} />}
    </div>
  );
}

/** Swipeable photos on a property card: arrows on hover (desktop), dots, and swipe on phones. */
export function CardCarousel({ images, href, title, priority = false }: { images: { src: string; alt: string }[]; href: string; title: string; priority?: boolean }) {
  const { ref, i, go } = useSlides(images.length);
  const stop = (e: React.MouseEvent, d: number) => { e.preventDefault(); e.stopPropagation(); go(d); };
  return (
    <div className="group/c relative aspect-[4/3] overflow-hidden rounded-2xl bg-neutral-100">
      <div ref={ref} className="s-scroll-x flex size-full snap-x snap-mandatory">
        {images.map((im, k) => (
          <Link key={k} href={href} className="relative block size-full shrink-0 snap-center snap-always" aria-label={k === 0 ? title : `${title}, photo ${k + 1}`} tabIndex={k === 0 ? 0 : -1}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={im.src} alt={im.alt} loading={priority && k === 0 ? "eager" : "lazy"} decoding="async" className="size-full object-cover" />
          </Link>
        ))}
      </div>
      {images.length > 1 && (
        <>
          {i > 0 && <Arrow dir="l" label="Previous photo" onClick={(e) => stop(e, -1)} className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/c:opacity-100 focus:opacity-100 max-sm:hidden" />}
          {i < images.length - 1 && <Arrow dir="r" label="Next photo" onClick={(e) => stop(e, 1)} className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/c:opacity-100 focus:opacity-100 max-sm:hidden" />}
          <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1">
            {images.map((_, k) => <span key={k} className={`size-1.5 rounded-full ${k === i ? "bg-white" : "bg-white/55"}`} />)}
          </div>
        </>
      )}
    </div>
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
              <span className="absolute inset-0 grid place-items-center"><span className="grid size-14 place-items-center rounded-full bg-white/90 text-charcoal shadow-lift"><Play className="ml-0.5 size-6 fill-current" /></span></span>
            </button>
          )}
          {v.caption && <figcaption className="bg-white px-3 py-2 text-sm text-charcoal">{v.caption}</figcaption>}
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
