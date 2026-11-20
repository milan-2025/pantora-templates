import Link from "next/link";
import type { ComponentProps } from "react";
import { isStandalonePage } from "@/lib/siteLinks";

/**
 * A link that works for every kind of address an editor can type: app pages use Next's <Link> (instant, prefetched);
 * other sites, mailto:/tel: and the stand-alone pages (/planner, /shaadi, /crm-software…) use a plain <a>.
 */
export function SmartLink({ href, ...rest }: Omit<ComponentProps<"a">, "href"> & { href: string }) {
  if (/^(https?:|mailto:|tel:|\/\/)/i.test(href) || isStandalonePage(href)) return <a href={href} {...rest} />;
  return <Link href={href} {...rest} />;
}
