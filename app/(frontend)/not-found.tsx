import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { buttonClasses } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="bg-glow grid min-h-screen place-items-center px-4 text-center">
      <div>
        <LogoMark className="mx-auto mb-6 size-20" animated />
        <h1 className="font-display text-5xl md:text-6xl">This box is empty</h1>
        <p className="mx-auto mt-4 max-w-md text-lg text-charcoal/70">We couldn&apos;t find that page. It may have moved.</p>
        <Link href="/" className={buttonClasses({ size: "lg", className: "mt-8" })}>
          Back to the homepage
        </Link>
      </div>
    </main>
  );
}
