import { jsonLdString } from "@/lib/structuredData";

/** Renders schema.org data for search engines. */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />;
}
