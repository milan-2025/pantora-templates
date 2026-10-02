"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  poster?: string;
  className?: string;
  /** Shown over the gradient when the video file is missing (dev hint). */
  label?: string;
};

/**
 * Lazy, muted, looping background video.
 * - Only loads once it nears the viewport.
 * - Pauses off-screen to save battery.
 * - Falls back to a poster / animated gradient if the file is missing or the
 *   user prefers reduced motion.
 * Drop AI-generated clips into /public/videos (see VIDEO_PROMPTS.md).
 */
export function VideoSlot({ src, poster, className = "", label }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [load, setLoad] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setLoad(true);
          el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const showVideo = !failed && !reduced;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Fallback layer: animated gradient (always rendered underneath) */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(120deg,var(--plum),var(--teal),var(--marigold),var(--coral),var(--plum))] bg-[length:300%_300%] animate-gradient"
        style={poster ? { backgroundImage: `url(${poster})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      />
      {failed && label && process.env.NODE_ENV === "development" && (
        <span className="absolute bottom-2 left-2 z-10 rounded-md bg-plum/80 px-2 py-1 font-mono text-[10px] text-cream">
          video slot: {label}
        </span>
      )}
      {showVideo && (
        <video
          ref={ref}
          className="absolute inset-0 h-full w-full object-cover"
          src={load ? src : undefined}
          poster={poster}
          muted
          loop
          playsInline
          autoPlay
          preload="none"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
