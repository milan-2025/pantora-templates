import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RichText } from "@payloadcms/richtext-lexical/react";
import { getPayloadClient, getPostBySlug } from "@/lib/cms/queries";
import { mediaDoc } from "@/lib/format";
import { SiteShell } from "@/components/SiteShell";
import { MediaSlot } from "@/components/ui/MediaSlot";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbJsonLd } from "@/lib/structuredData";
import { DEFAULT_SHARE_IMAGE } from "@/lib/cms/seo";

export const revalidate = 300;

type Args = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const payload = await getPayloadClient();
  const posts = await payload.find({
    collection: "posts",
    where: { _status: { equals: "published" } },
    limit: 500,
    depth: 0,
    select: { slug: true },
  });
  return posts.docs.map((p) => ({ slug: p.slug }));
}

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" });

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};
  const title = post.seo?.title || post.title;
  const description = post.seo?.description || post.excerpt || undefined;
  const cover = mediaDoc(post.coverImage);
  return {
    title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      url: `/blog/${post.slug}`,
      publishedTime: post.publishedAt ?? undefined,
      images: cover ? [cover.url] : [DEFAULT_SHARE_IMAGE],
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function BlogPost({ params }: Args) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    datePublished: post.publishedAt,
    author: { "@type": "Organization", name: post.author || "Pandora Templates" },
  };

  return (
    <SiteShell>
      <JsonLd data={jsonLd} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
          { name: post.title, path: `/blog/${post.slug}` },
        ])}
      />
      <article className="px-4 pb-24 pt-32 md:pt-40">
        <div className="mx-auto max-w-3xl">
          <Link href="/blog" className="mb-8 inline-flex items-center gap-1 text-sm font-medium text-teal hover:underline">
            <ArrowLeft className="size-4" /> All posts
          </Link>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-coral">
            {post.publishedAt && dateFmt.format(new Date(post.publishedAt))}
            {post.author && ` · ${post.author}`}
          </p>
          <h1 className="font-display text-4xl leading-tight md:text-6xl">{post.title}</h1>
          {post.excerpt && <p className="mt-5 text-xl leading-relaxed text-charcoal/70">{post.excerpt}</p>}
        </div>
        <MediaSlot media={post.coverImage} priority className="mx-auto mt-10 aspect-[16/9] w-full max-w-5xl rounded-4xl shadow-lift" sizes="(max-width: 1024px) 100vw, 1024px" />
        <div className="prose-pandora mx-auto mt-12 max-w-3xl">
          <RichText data={post.content} />
        </div>
      </article>
    </SiteShell>
  );
}
