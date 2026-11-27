import { CategoryPage, categoryMetadata } from "@/components/category/CategoryPage";

export const revalidate = 300;
export const metadata = categoryMetadata("self-improvement");

/** pandoratemplates.com/self-improvement: every app and template in this category (see lib/siteLinks.ts). */
export default function Page() {
  return <CategoryPage categoryKey="self-improvement" />;
}
