import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Footer } from "@/components/sections/Footer";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="bg-grid min-h-screen px-4 pb-20 pt-6">
        <header className="mx-auto mb-10 flex max-w-3xl items-center justify-between">
          <Logo />
          <Link href="/" className="flex items-center gap-1 text-sm font-medium text-plum hover:text-teal">
            <ArrowLeft className="size-4" /> Home
          </Link>
        </header>
        <article className="card mx-auto max-w-3xl rounded-3xl p-6 md:p-10 [&_a]:text-teal [&_h1]:mb-2 [&_h1]:font-display [&_h1]:text-4xl [&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-2xl [&_li]:ml-5 [&_li]:list-disc [&_p]:mb-3 [&_p]:leading-relaxed [&_ul]:mb-3">
          {children}
        </article>
      </div>
      <Footer />
    </>
  );
}
