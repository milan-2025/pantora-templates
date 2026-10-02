import type { ReactNode } from "react";

/** Infinite horizontal scroller. Children are duplicated for a seamless loop. */
export function Marquee({ children, reverse = false, className = "" }: { children: ReactNode; reverse?: boolean; className?: string }) {
  return (
    <div className={`group flex overflow-hidden ${className}`}>
      <div
        className="flex w-max shrink-0 animate-marquee gap-6 pr-6 group-hover:[animation-play-state:paused]"
        style={reverse ? { animationDirection: "reverse" } : undefined}
      >
        {children}
        <div aria-hidden className="contents">
          {children}
        </div>
      </div>
    </div>
  );
}
