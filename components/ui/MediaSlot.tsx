"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { Media } from "@/payload-types";
import { isVideo, mediaDoc } from "@/lib/format";

type Props = {
  media: number | Media | null | undefined;
  className?: string;
  /** Rendered when nothing is uploaded. Defaults to nothing at all (no empty block). */
  fallback?: React.ReactNode;
  sizes?: string;
  priority?: boolean;
};

/**
 * Shows an uploaded video (lazy, muted, looping, pauses off-screen) or image.
 * With no upload it renders `fallback`, or nothing.
 */
export function MediaSlot({ media, className = "", fallback = null, sizes = "(max-width: 768px) 100vw, 50vw", priority }: Props) {
  const doc = mediaDoc(media);
  if (!doc) return <>{fallback}</>;

  if (isVideo(doc)) return <LazyVideo src={doc.url} className={className} label={doc.alt} />;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Image
        src={doc.url}
        alt={doc.alt}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
        style={doc.focalX != null ? { objectPosition: `${doc.focalX}% ${doc.focalY ?? 50}%` } : undefined}
      />
    </div>
  );
}

function LazyVideo({ src, className, label }: { src: string; className: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [load, setLoad] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setLoad(true);
          if (!reduced) el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className={`relative overflow-hidden bg-lavender ${className}`}>
      <video
        ref={ref}
        aria-label={label}
        className="absolute inset-0 h-full w-full object-cover"
        src={load ? src : undefined}
        muted
        loop
        playsInline
        preload="none"
      />
    </div>
  );
}
