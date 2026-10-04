import type { Metadata } from "next";
import Link from "next/link";
import { getPosts } from "@/lib/cms/queries";
import { SiteShell } from "@/components/SiteShell";
import { MediaSlot } from "@/components/ui/MediaSlot";
import { Reveal } from "@/components/ui/Reveal";
import { Sparkle } from "@/components/ui/Squiggle";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Blog",
  description: "Wedding planning tips, budgeting guides and template how-tos.",
};

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" });

export default async function BlogIndex() {
  const posts = await getPosts();
  return (
    <SiteShell>
      <section className="bg-glow px-4 pb-10 pt-32 text-center md:pt-40">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-teal">Blog</p>
        <h1 className="font-display text-5xl md:text-7xl">
          Ideas for life&apos;s <span className="italic text-marigold">big moments</span>
        </h1>
      </section>
      <section className="px-4 pb-24">
        <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {posts.length === 0 && <p className="col-span-full text-center text-charcoal/60">No posts yet. Check back soon.</p>}
          {posts.map((post, i) => (
            <Reveal key={post.id} delay={i * 0.05}>
              <Link href={`/blog/${post.slug}`} className="card group block h-full overflow-hidden rounded-3xl transition-shadow hover:shadow-lift">
                <MediaSlot
                  media={post.coverImage}
                  className="aspect-[16/10] w-full"
                  sizes="(max-width: 768px) 100vw, 33vw"
                  fallback={
                    <div className="grid aspect-[16/10] w-full place-items-center bg-lavender">
                      <Sparkle className="size-10" />
                    </div>
                  }
                />
                <div className="p-6">
                  {post.publishedAt && (
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-teal">
                      {dateFmt.format(new Date(post.publishedAt))}
                    </p>
                  )}
                  <h2 className="font-display text-2xl leading-snug group-hover:text-teal">{post.title}</h2>
                  {post.excerpt && <p className="mt-2 line-clamp-3 text-charcoal/70">{post.excerpt}</p>}
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
