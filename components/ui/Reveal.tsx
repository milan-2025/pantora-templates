"use client";

import { motion, type HTMLMotionProps } from "motion/react";

type Props = HTMLMotionProps<"div"> & {
  delay?: number;
  y?: number;
  rotate?: number;
};

/** Fades + slides children in when they scroll into view. */
export function Reveal({ delay = 0, y = 40, rotate = 0, children, ...rest }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y, rotate: rotate * 2 }}
      whileInView={{ opacity: 1, y: 0, rotate }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ type: "spring", stiffness: 120, damping: 16, delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
