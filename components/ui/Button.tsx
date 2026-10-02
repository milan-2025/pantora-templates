import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const variants = {
  /** Marigold: the brand's button colour */
  primary: "bg-marigold text-plum hover:bg-[#f5b552]",
  plum: "bg-plum text-cream hover:bg-[#4a2a5c]",
  teal: "bg-teal text-cream hover:bg-[#238a83]",
  outline: "bg-transparent text-plum ring-[1.5px] ring-inset ring-plum/25 shadow-none hover:bg-plum/5",
};

const sizes = {
  md: "px-5 py-2.5 text-[0.95rem]",
  lg: "px-7 py-3.5 text-base md:text-lg",
};

type Common = {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  className?: string;
  children: ReactNode;
};

export function buttonClasses({ variant = "primary", size = "md", className = "" }: Omit<Common, "children">) {
  return `inline-flex items-center justify-center gap-2 rounded-full font-semibold shadow-soft
    transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift active:translate-y-0
    focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum
    disabled:pointer-events-none disabled:opacity-60
    ${variants[variant]} ${sizes[size]} ${className}`;
}

export function ButtonLink({ href, variant, size, className, children, ...rest }: Common & ComponentProps<typeof Link>) {
  return (
    <Link href={href} className={buttonClasses({ variant, size, className })} {...rest}>
      {children}
    </Link>
  );
}

export function Button({ variant, size, className, children, ...rest }: Common & ComponentProps<"button">) {
  return (
    <button className={buttonClasses({ variant, size, className })} {...rest}>
      {children}
    </button>
  );
}
