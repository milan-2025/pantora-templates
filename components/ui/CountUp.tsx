"use client";

import { useEffect, useRef } from "react";
import { animate, useInView } from "motion/react";

/** Animates a number from 0 → value when it scrolls into view. */
export function CountUp({
  value,
  format = (n) => Math.round(n).toLocaleString("en-IN"),
  duration = 1.4,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const formatRef = useRef(format);
  formatRef.current = format;

  useEffect(() => {
    if (!inView || !ref.current) return;
    const el = ref.current;
    const controls = animate(0, value, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => (el.textContent = formatRef.current(v)),
    });
    return () => controls.stop();
  }, [inView, value, duration]);

  return (
    <span ref={ref} className={className}>
      {format(0)}
    </span>
  );
}
