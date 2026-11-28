import type { Metadata } from "next";
import { SiteShell } from "@/components/SiteShell";
import { JsonLd } from "@/components/JsonLd";
import { FAQ } from "@/components/sections/FAQ";
import { FeatureIcon } from "@/components/ui/FeatureIcon";
import { SmartLink } from "@/components/ui/SmartLink";
import { getPayloadClient } from "@/lib/cms/queries";
import { DEFAULT_SHARE_IMAGE } from "@/lib/cms/seo";
import { packInfo } from "@/lib/invitePlanner";
import { getPlanConfig } from "@/lib/invites";
import { getPhotoPlans, planOf } from "@/lib/photos/plans";
import { getPlans } from "@/lib/planner/server";
import { breadcrumbJsonLd, siteUrl } from "@/lib/structuredData";

export const revalidate = 300;

const TITLE = "Shaadi Pack: wedding planner, digital invite and photo gallery in one";
const DESCRIPTION =
  "Plan the wedding with the family, send every family its own digital invite, then share every photo in one private link. Three apps, one payment.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/shaadi-pack" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/shaadi-pack", images: [DEFAULT_SHARE_IMAGE] },
  twitter: { card: "summary_large_image" },
};

const ACCENT = "#A23A2F";
const TINT = "#F8E1DD";
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const SIGNUP = "/planner/signup?pack=1&utm_source=shaadi-pack";
const LOGIN = "/planner/login?pack=1&utm_source=shaadi-pack";

/** Live prices from the admin: the pack, and what the three parts cost on their own. */
async function prices() {
  try {
    const payload = await getPayloadClient();
    const [pack, plans, invites, photos] = await Promise.all([packInfo(payload), getPlans(payload), getPlanConfig(payload), getPhotoPlans(payload)]);
    const family = plans.find((p) => p.planId === "family" && p.active);
    const invite = invites.plans.find((p) => p.id === "premium");
    const photo = planOf(photos, pack.photoPlan);
    return { pack, family, invite, photo };
  } catch (e) {
    console.error("[shaadi-pack] prices", e);
    return null;
  }
}

/** pandoratemplates.com/shaadi-pack: Planner + Invite + Photo gallery sold together; bought inside the planner. */
export default async function Page() {
  const p = await prices();
  const on = !!(p && p.pack.on && p.family);
  const parts = p && p.family && p.invite ? p.family.price + p.invite.price + p.photo.price : 0;
  const save = on && parts > p!.pack.price ? parts - p!.pack.price : 0;

  const products = [
    {
      icon: "CalendarHeart",
      name: "Online Wedding Planner",
      plan: p?.family ? `${p.family.name} plan` : "Family plan",
      price: p?.family?.price,
      href: "/planner",
      points: [
        "Guests, RSVPs, rooms and cabs for every function",
        "Budget, vendors, advances and payment reminders",
        p?.family?.collaborators ? `Up to ${p.family.collaborators} family members on the same planner` : "Your family on the same planner",
        "Shagun register and the day's run sheet",
      ],
    },
    {
      icon: "Mail",
      name: "Digital Wedding Invite",
      plan: p?.invite ? `${p.invite.name} plan` : "Premium plan",
      price: p?.invite?.price,
      href: "/shaadi",
      points: ["Designed with your names, functions, map and music", "A personal link for every family, showing only their functions", "Share on WhatsApp", "RSVPs and blessings fill in the planner's guest list"],
    },
    {
      icon: "Image",
      name: "Wedding Photo Gallery",
      plan: p ? `${p.photo.name} plan` : "Premium plan",
      price: p?.photo.price,
      href: "/photos",
      points: [
        p ? `Up to ${p.photo.maxPhotos.toLocaleString("en-IN")} photos in one private link` : "Every photo in one private link",
        "Albums for Haldi, Mehendi, Sangeet, Wedding…",
        "QR code card for the venue",
        p && p.photo.guestUploads ? "Guests add their own photos" + (p.photo.videoGb ? ` · ${p.photo.videoGb} GB of video` : "") : "Optional PIN for guests",
      ],
    },
  ];

  return (
    <SiteShell>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Weddings & Events", path: "/weddings" },
          { name: "Shaadi Pack", path: "/shaadi-pack" },
        ])}
      />
      {on ? (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Product",
            name: "Shaadi Pack",
            description: DESCRIPTION,
            url: `${siteUrl()}/shaadi-pack`,
            brand: { "@type": "Brand", name: "Pandora Templates" },
            offers: { "@type": "Offer", price: p!.pack.price, priceCurrency: "INR", availability: "https://schema.org/InStock", url: `${siteUrl()}/shaadi-pack` },
          }}
        />
      ) : null}

      <section className="px-4 pb-14 pt-32 md:pb-20 md:pt-40" style={{ background: `linear-gradient(180deg, ${TINT} 0%, var(--cream) 100%)` }}>
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: ACCENT }}>
            Shaadi Pack · three apps, one payment
          </p>
          <h1 className="font-display text-5xl leading-tight md:text-6xl">Plan it. Invite everyone. Keep every photo.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-charcoal/75">
            The wedding planner your family shares, a digital invite with a link for every family, and a private photo gallery for after the wedding. All three are connected: your guest list fills the invite, and RSVPs come back by themselves.
          </p>
          {on ? (
            <div className="mx-auto mt-8 inline-block rounded-3xl bg-paper px-8 py-6 shadow-sm">
              <div className="font-display text-5xl text-plum">{inr(p!.pack.price)}</div>
              <div className="mt-1 text-charcoal/70">
                one-time{save ? (
                  <>
                    {" "}· worth <s>{inr(parts)}</s> · <b style={{ color: ACCENT }}>save {inr(save)}</b>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <SmartLink href={SIGNUP} className="rounded-full bg-marigold px-7 py-3.5 text-lg font-semibold text-plum shadow-soft">
              {on ? "Start free, then choose the pack" : "Start the planner free"}
            </SmartLink>
            <SmartLink href={LOGIN} className="rounded-full px-7 py-3.5 text-lg font-semibold text-plum ring-[1.5px] ring-plum/25">
              I already have a planner
            </SmartLink>
          </div>
          <p className="mt-3 text-sm text-charcoal/60">14-day free trial, no card. Buy the pack from the planner when you&rsquo;re ready.</p>
        </div>
      </section>

      <section className="px-4 py-16 md:py-20">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
          {products.map((x) => (
            <div key={x.name} className="card flex flex-col rounded-3xl p-6 md:p-7" style={{ borderTop: `4px solid ${ACCENT}` }}>
              <span className="mb-4 grid size-12 place-items-center rounded-2xl" style={{ background: TINT, color: ACCENT }}>
                <FeatureIcon name={x.icon} className="size-6" />
              </span>
              <h2 className="font-display text-2xl">{x.name}</h2>
              <p className="mt-1 text-sm text-charcoal/65">
                {x.plan}
                {x.price ? <> · {inr(x.price)} on its own</> : null}
              </p>
              <ul className="mt-4 grid flex-1 content-start gap-2 text-[0.95rem]">
                {x.points.map((pt) => (
                  <li key={pt} className="flex gap-2">
                    <span style={{ color: ACCENT }}>✓</span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
              <SmartLink href={x.href} className="mt-5 text-sm font-semibold hover:underline" style={{ color: ACCENT }}>
                See {x.name.toLowerCase()} →
              </SmartLink>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-sand px-4 py-16 md:py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center font-display text-4xl md:text-5xl">How it works</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              ["Start the planner free", "Sign up with your email. Add your names, date, functions and guest list. The trial is 14 days, no card needed."],
              ["Choose the Shaadi Pack", "When you're ready, open Plan & billing in the planner and pick the Shaadi Pack. One payment by UPI or card."],
              ["The invite and gallery are made for you", "Your invite goes live on Premium with your planner's details filled in, and your photo gallery is ready for the wedding. Both links come by email too."],
            ].map(([h, t], i) => (
              <li key={h} className="rounded-3xl bg-paper p-6">
                <span className="grid size-9 place-items-center rounded-full font-semibold text-cream" style={{ background: ACCENT }}>
                  {i + 1}
                </span>
                <h3 className="mt-4 font-display text-xl">{h}</h3>
                <p className="mt-2 text-charcoal/75">{t}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <FAQ
        eyebrow="Questions"
        heading="About the Shaadi Pack"
        items={[
          { question: "What is in the Shaadi Pack?", answer: `The Online Wedding Planner on the ${p?.family?.name ?? "Family"} plan, the digital wedding invite on ${p?.invite?.name ?? "Premium"}, and a wedding photo gallery on the ${p?.photo.name ?? "Premium"} plan, bought together in one payment.` },
          { question: "How long does it last?", answer: `The planner plan is valid for ${p?.family ? Math.round(p.family.durationDays / 365) || 1 : 1} year, the invite stays live for its plan period, and the photo gallery stays online for ${p ? (p.photo.months >= 12 ? `${p.photo.months / 12} year${p.photo.months > 12 ? "s" : ""}` : `${p.photo.months} months`) : "its plan period"} after you buy, so the photos are there long after the wedding.` },
          { question: "I already made an invite or a photo gallery. Will I lose it?", answer: "No. Connect your existing invite from the planner first and the pack upgrades that one. A gallery made with the same email address is upgraded too, instead of making a new one." },
          { question: "Can I use a coupon code?", answer: "Yes. Enter it in the plan window before you pay. Codes made for the Shaadi Pack, or for everything, work on it." },
          { question: "Do my guests need to sign up?", answer: "No. Guests open the invite and the photo gallery from a link on WhatsApp. Only you and the family members you add to the planner sign in." },
        ]}
      />

      <section className="px-4 pb-20 text-center" data-pt-final>
        <SmartLink href={SIGNUP} className="inline-block rounded-full bg-marigold px-8 py-4 text-lg font-semibold text-plum shadow-soft">
          {on ? `Get the Shaadi Pack${p ? ` for ${inr(p.pack.price)}` : ""}` : "Start the planner free"}
        </SmartLink>
      </section>
    </SiteShell>
  );
}
