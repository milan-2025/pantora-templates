"use client";
/* eslint-disable @next/next/no-img-element -- Cloudinary photos, resized in the URL */
import { useState } from "react";
import { ExternalLink, ImagePlus, Star, Trash2 } from "lucide-react";
import type { Rec } from "@/lib/hostbook/core";
import { SITE_AMENITIES, SITE_PATH, cleanSlug, listingPath } from "@/lib/hostbook/site";
import { api, uploadSigned } from "../api";
import { useStore } from "../store";
import { Badge, Button, Card, Field, Input, PageHead, Sheet, Textarea, cx } from "../ui";

type SiteForm = { on: boolean; title: string; tagline: string; about: string; whatsapp: string; heroUrl: string; instagram: string };

async function uploadPhoto(file: File): Promise<string> {
  const sig = await api("site/sign", { body: {} });
  const r = await uploadSigned(sig, file);
  return String(r.secure_url || "");
}

/**
 * HostBook → Website: the host's own booking page at pandoratemplates.com/h/<name>. Guests see the listings,
 * photos and free dates, and send a booking enquiry to the host's WhatsApp. Owner only.
 */
export function WebsiteScreen() {
  const s = useStore();
  const a = s.me.account as typeof s.me.account & { siteSlug?: string; site?: SiteForm };
  const [slug, setSlug] = useState(a.siteSlug || cleanSlugOr(a.business));
  // Saved settings win; empty ones fall back to the business name and phone from Settings.
  const saved: Partial<SiteForm> = a.site ?? {};
  const [f, setF] = useState<SiteForm>({
    on: saved.on === true, title: saved.title || a.business || "", tagline: saved.tagline || "", about: saved.about || "",
    whatsapp: saved.whatsapp || a.phone || "", heroUrl: saved.heroUrl || "", instagram: saved.instagram || "",
  });
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<Rec | null>(null);
  const set = <K extends keyof SiteForm>(k: K, v: SiteForm[K]) => setF((x) => ({ ...x, [k]: v }));
  const listings = s.of("listing").filter((l) => !l.archived);
  const live = Boolean(a.site?.on && a.siteSlug);
  const url = `${typeof location !== "undefined" ? location.origin : ""}${SITE_PATH}/${a.siteSlug || slug}`;

  const save = async (on = f.on) => {
    setBusy(true);
    try {
      await api("site", { body: { slug, site: { ...f, on } } });
      await s.reloadMe();
      setF((x) => ({ ...x, on }));
      s.toast(on ? "Your website is live" : "Saved");
    } catch (e) { s.toast((e as Error).message, "bad"); } finally { setBusy(false); }
  };
  const hero = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try { set("heroUrl", await uploadPhoto(file)); s.toast("Photo added. Save to keep it."); } catch (e) { s.toast((e as Error).message, "bad"); } finally { setBusy(false); }
  };
  const toggleListing = async (l: Rec) => {
    try { await s.save("listing", { onSite: !l.onSite }, l.id); } catch (e) { s.toast((e as Error).message, "bad"); }
  };

  if (!s.can("owner")) return <><PageHead title="Website" /><Card className="p-5 text-sm text-ink/70">Only the account owner can set up the booking website.</Card></>;

  return (
    <>
      <PageHead
        title="Website"
        sub="Your own booking page. Guests see your places and free dates, and message you on WhatsApp. No booking fee."
        action={live ? <a href={url} target="_blank" rel="noopener noreferrer"><Button tone="soft"><ExternalLink className="size-4" /> Open</Button></a> : undefined}
      />
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">Your website {live ? <Badge tone="ok">Live</Badge> : <Badge>Off</Badge>}</p>
          {live ? <Button tone="ghost" size="sm" disabled={busy} onClick={() => save(false)}>Turn off</Button> : null}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Website address" hint={`pandoratemplates.com${SITE_PATH}/${slug || "your-name"}`}>
            <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} placeholder="your-business-name" />
          </Field>
          <Field label="WhatsApp number for enquiries" hint="Guests' messages come here">
            <Input inputMode="tel" value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="98765 43210" />
          </Field>
          <Field label="Name on the website"><Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Pine View Homestays" /></Field>
          <Field label="One line about you"><Input value={f.tagline} onChange={(e) => set("tagline", e.target.value)} placeholder="e.g. Family homestays 10 minutes from Mall Road" /></Field>
          <Field label="About" className="sm:col-span-2"><Textarea rows={4} value={f.about} onChange={(e) => set("about", e.target.value)} placeholder="Who you are, what guests love about your places, how to reach you." /></Field>
          <Field label="Instagram (optional)"><Input value={f.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="@yourpage" /></Field>
          <Field label="Cover photo">
            <div className="flex items-center gap-3">
              {f.heroUrl ? <img src={f.heroUrl.replace("/upload/", "/upload/c_fill,w_160,h_100/")} alt="" className="h-14 w-24 rounded-lg object-cover" /> : null}
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-mist px-3 py-2 text-sm font-semibold text-teal">
                <ImagePlus className="size-4" /> {f.heroUrl ? "Change" : "Add photo"}
                <input type="file" accept="image/*" hidden onChange={(e) => hero(e.target.files?.[0])} />
              </label>
              {f.heroUrl ? <button type="button" className="text-sm text-rust" onClick={() => set("heroUrl", "")}>Remove</button> : null}
            </div>
          </Field>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => save(true)}>{busy ? "Saving…" : live ? "Save changes" : "Save and publish"}</Button>
          {!live ? <Button tone="ghost" disabled={busy} onClick={() => save(false)}>Save without publishing</Button> : null}
        </div>
      </Card>

      <h2 className="mb-2 mt-6 font-semibold">Places on your website</h2>
      {listings.length ? (
        <div className="grid gap-3">
          {listings.map((l) => {
            const photos = (l.photos as string[] | undefined) ?? [];
            return (
              <Card key={l.id} className="flex flex-wrap items-center gap-3 p-4">
                {photos[0] ? <img src={photos[0].replace("/upload/", "/upload/c_fill,w_120,h_90/")} alt="" className="h-14 w-20 rounded-lg object-cover" /> : <div className="h-14 w-20 rounded-lg bg-mist" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{String(l.name || "Listing")}</p>
                  <p className="text-xs text-ink/60">{photos.length} photo{photos.length === 1 ? "" : "s"}{l.price ? ` · ₹${Number(l.price).toLocaleString("en-IN")}/night` : " · no price yet"}</p>
                </div>
                <Button tone="soft" size="sm" onClick={() => setEdit(l)}>Edit page</Button>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={l.onSite === true} onChange={() => toggleListing(l)} /> Show
                </label>
                {live && l.onSite ? (
                  <a className="text-sm text-teal underline" href={`${SITE_PATH}/${a.siteSlug}/${listingPath({ id: l.id, name: String(l.name || "") })}`} target="_blank" rel="noopener noreferrer">View</a>
                ) : null}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-5 text-sm text-ink/70">Add a listing first (More → Listings), then show it here.</Card>
      )}
      <p className="mt-3 text-xs text-ink/60">Free dates come from your bookings and your Airbnb / Booking.com calendar sync. Guests never see who is staying, your exact address or Wi-Fi.</p>
      {edit ? <ListingPage listing={edit} onClose={() => setEdit(null)} /> : null}
    </>
  );
}

function cleanSlugOr(v: string) {
  const r = cleanSlug(v);
  return "slug" in r ? r.slug : "";
}

/** What guests see about one place: photos, words, price, rooms and amenities. */
function ListingPage({ listing, onClose }: { listing: Rec; onClose: () => void }) {
  const s = useStore();
  const [f, setF] = useState({
    headline: String(listing.headline ?? ""), description: String(listing.description ?? ""), area: String(listing.area ?? ""),
    price: String(listing.price || ""), maxGuests: String(listing.maxGuests || ""), bedrooms: String(listing.bedrooms || ""), bathrooms: String(listing.bathrooms || ""),
    amenities: (listing.amenities as string[] | undefined) ?? [], photos: (listing.photos as string[] | undefined) ?? [],
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const room = 15 - f.photos.length;
      const urls: string[] = [];
      for (const file of [...files].slice(0, room)) urls.push(await uploadPhoto(file));
      setF((x) => ({ ...x, photos: [...x.photos, ...urls].slice(0, 15) }));
    } catch (e) { s.toast((e as Error).message, "bad"); } finally { setBusy(false); }
  };
  const save = async () => {
    setBusy(true);
    try {
      await s.save("listing", { ...f, price: Number(f.price) || 0, maxGuests: Number(f.maxGuests) || 0, bedrooms: Number(f.bedrooms) || 0, bathrooms: Number(f.bathrooms) || 0 }, listing.id);
      s.toast("Saved"); onClose();
    } catch (e) { s.toast((e as Error).message, "bad"); } finally { setBusy(false); }
  };
  return (
    <Sheet open wide onClose={onClose} title={`Website page: ${String(listing.name || "Listing")}`} footer={<><Button tone="ghost" onClick={onClose}>Cancel</Button><Button disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</Button></>}>
      <Field label={`Photos (${f.photos.length}/15)`} hint="The first photo is the cover. Tap ★ to make a photo the cover.">
        <div className="flex flex-wrap gap-2">
          {f.photos.map((p, i) => (
            <div key={p} className="relative">
              <img src={p.replace("/upload/", "/upload/c_fill,w_200,h_150/")} alt="" className={cx("h-20 w-28 rounded-lg object-cover", i === 0 && "ring-2 ring-teal")} />
              <div className="absolute inset-x-1 bottom-1 flex justify-between">
                <button type="button" aria-label="Make cover" className="grid size-6 place-items-center rounded-full bg-white/90" onClick={() => set("photos", [p, ...f.photos.filter((x) => x !== p)])}><Star className="size-3.5" /></button>
                <button type="button" aria-label="Remove photo" className="grid size-6 place-items-center rounded-full bg-white/90 text-rust" onClick={() => set("photos", f.photos.filter((x) => x !== p))}><Trash2 className="size-3.5" /></button>
              </div>
            </div>
          ))}
          {f.photos.length < 15 ? (
            <label className="grid h-20 w-28 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-line text-xs text-ink/60">
              <span className="flex flex-col items-center gap-1"><ImagePlus className="size-5" />{busy ? "Uploading…" : "Add photos"}</span>
              <input type="file" accept="image/*" multiple hidden onChange={(e) => add(e.target.files)} />
            </label>
          ) : null}
        </div>
      </Field>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="One line about this place" className="sm:col-span-2"><Input value={f.headline} onChange={(e) => set("headline", e.target.value)} placeholder="e.g. Cosy 2BHK with a mountain-view balcony" /></Field>
        <Field label="Description" className="sm:col-span-2"><Textarea rows={5} value={f.description} onChange={(e) => set("description", e.target.value)} /></Field>
        <Field label="Area (shown to guests)" hint="Not the exact address: that's shared after booking"><Input value={f.area} onChange={(e) => set("area", e.target.value)} placeholder="e.g. Sector 20, near the lake" /></Field>
        <Field label="Price per night from (₹)"><Input type="number" inputMode="numeric" value={f.price} onChange={(e) => set("price", e.target.value)} /></Field>
        <Field label="Guests"><Input type="number" inputMode="numeric" value={f.maxGuests} onChange={(e) => set("maxGuests", e.target.value)} /></Field>
        <Field label="Bedrooms"><Input type="number" inputMode="numeric" value={f.bedrooms} onChange={(e) => set("bedrooms", e.target.value)} /></Field>
        <Field label="Bathrooms"><Input type="number" inputMode="numeric" value={f.bathrooms} onChange={(e) => set("bathrooms", e.target.value)} /></Field>
      </div>
      <Field label="Amenities" className="mt-3">
        <div className="grid grid-cols-2 gap-1.5 text-sm sm:grid-cols-3">
          {SITE_AMENITIES.map((am) => (
            <label key={am} className="flex items-center gap-2">
              <input type="checkbox" checked={f.amenities.includes(am)} onChange={() => set("amenities", f.amenities.includes(am) ? f.amenities.filter((x) => x !== am) : [...f.amenities, am])} /> {am}
            </label>
          ))}
        </div>
      </Field>
      <p className="mt-3 text-xs text-ink/60">Check-in and check-out times and house rules come from the listing (More → Listings).</p>
    </Sheet>
  );
}
