"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";
import type { Media } from "@/payload-types";
import { isVideo, mediaDoc } from "@/lib/format";

type Props = {
  media: string | Media | null | undefined;
  className?: string;
  /** Rendered when nothing is uploaded. Defaults to nothing at all (no empty block). */
  fallback?: React.ReactNode;
  sizes?: string;
  priority?: boolean;
  /**
   * Background/decorative use: a video shows only its still frame (no player),
   * so it never downloads the video.
   */
  decorative?: boolean;
};

/**
 * Cloudinary turns a video into a still image (its first frame) when the link's extension
 * is changed to .jpg. Returns null for videos stored elsewhere.
 */
export function videoPosterUrl(url: string) {
  if (!url.includes("res.cloudinary.com") || !url.includes("/video/")) return null;
  return url.replace(/\.[a-z0-9]+(\?|$)/i, ".jpg$1");
}

/**
 * Shows an uploaded image, or a video that only plays when the visitor taps play
 * (no autoplay, so videos use no bandwidth until someone wants to watch).
 * With no upload it renders `fallback`, or nothing.
 */
export function MediaSlot({ media, className = "", fallback = null, sizes = "(max-width: 768px) 100vw, 50vw", priority, decorative }: Props) {
  const doc = mediaDoc(media);
  if (!doc) return <>{fallback}</>;

  if (isVideo(doc)) {
    const poster = videoPosterUrl(doc.url);
    if (decorative) {
      return poster ? <Still src={poster} alt={doc.alt} className={className} sizes={sizes} priority={priority} /> : <>{fallback}</>;
    }
    return <ClickToPlayVideo src={doc.url} poster={poster} label={doc.alt} className={className} sizes={sizes} />;
  }

  return (
    <Still
      src={doc.url}
      alt={doc.alt}
      className={className}
      sizes={sizes}
      priority={priority}
      objectPosition={doc.focalX != null ? `${doc.focalX}% ${doc.focalY ?? 50}%` : undefined}
    />
  );
}

function Still({
  src,
  alt,
  className,
  sizes,
  priority,
  objectPosition,
}: {
  src: string;
  alt: string;
  className: string;
  sizes: string;
  priority?: boolean;
  objectPosition?: string;
}) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" style={objectPosition ? { objectPosition } : undefined} />
    </div>
  );
}

function ClickToPlayVideo({
  src,
  poster,
  label,
  className,
  sizes,
}: {
  src: string;
  poster: string | null;
  label: string;
  className: string;
  sizes: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const start = () => {
    setPlaying(true);
    // The <video> mounts with this click, so start it on the next frame.
    requestAnimationFrame(() => ref.current?.play().catch(() => {}));
  };

  return (
    <div className={`relative overflow-hidden bg-plum ${className}`}>
      {playing ? (
        <video
          ref={ref}
          aria-label={label}
          className="absolute inset-0 h-full w-full bg-plum object-contain"
          src={src}
          poster={poster ?? undefined}
          controls
          playsInline
          preload="auto"
        />
      ) : (
        <button
          type="button"
          onClick={start}
          aria-label={`Play video: ${label}`}
          className="group absolute inset-0 grid place-items-center"
        >
          {poster ? (
            <Image src={poster} alt="" fill sizes={sizes} className="object-cover transition-transform duration-500 group-hover:scale-105" />
          ) : (
            <span aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,var(--teal),var(--plum))]" />
          )}
          <span aria-hidden className="absolute inset-0 bg-plum/15 transition-colors group-hover:bg-plum/5" />
          <span className="relative grid size-16 place-items-center rounded-full bg-marigold text-plum shadow-lift transition-transform group-hover:scale-110 md:size-20">
            <Play className="ml-1 size-7 fill-plum md:size-8" />
          </span>
        </button>
      )}
    </div>
  );
}
