/**
 * Headline versions for ads. A link like /shaadi?v=rsvp shows the matching headline, so the page says what the ad
 * said. No v (or an unknown one) shows "main". The version is sent to Meta with every Pixel event as ad_variant
 * (see public/pt-track.js), so Ads Manager can compare them.
 *
 * The planner's versions live in planner-app/landing.js; the workout app's in workout-app/landing.js; the two
 * LeadFlow pages' in public/crm-software.html and public/real-estate-crm.html (plain HTML, no build step).
 * Keep those in step with the lists below when adding a version, and add it to the README table.
 */
export type Headline = { h: string; p: string };

export const AD_VARIANTS = {
  invites: {
    main: { h: "Your wedding invite, ready for WhatsApp tonight", p: "Every function with its date, venue and map. RSVPs that count themselves. Photos, music and a countdown. One link the whole family can share." },
    rsvp: { h: "Know exactly who is coming, function by function", p: "Guests tap RSVP on your invite and the count updates itself: Haldi, Mehendi, Sangeet, wedding. No more calling every uncle to ask." },
    save: { h: "Save the date in five minutes, from your phone", p: "Pick a design, add your names and date, and send it on WhatsApp tonight. Add every function and the map later." },
    cost: { h: "No printing, no courier. One link for every guest", p: "A beautiful digital invite costs less than a box of printed cards, reaches everyone instantly, and can be updated any time." },
    family: { h: "One invite link for the whole family to share", p: "Mummy, Papa and the cousins forward the same link, so every guest sees the right dates, venues and map, always up to date." },
  },
  photos: {
    main: { h: "Every wedding photo, in one beautiful link", p: "Haldi to vidaai, sorted into albums. Send one link on WhatsApp or put a QR code at the venue, and the whole family sees every photo and video. No app, no Google Drive mess." },
    guests: { h: "Get every guest's photos, not just the photographer's", p: "Put a QR code at the venue. Guests add their clicks from their own phones, you approve them, and every photo lands in one album." },
    qr: { h: "One QR code at the venue. Every photo in one place", p: "Guests scan, see the albums and add their own photos. Afterwards, send the same link on WhatsApp to everyone who couldn't come." },
    albums: { h: "Haldi, Mehendi, Sangeet, wedding: an album for each", p: "Photos and videos sorted by function, in full quality, with a PIN if you want it private. Share one link instead of fifty WhatsApp forwards." },
  },
  hostbook: {
    main: { h: "Every guest, booking and rupee. One book.", p: "Keep a proper guest register with IDs, sync your Airbnb calendar, hand jobs to your caretaker and finally see what each listing really earns." },
    register: { h: "Guest IDs and the police register, without the paper", p: "Guests fill in their details and ID photos from a link before they arrive. Aadhaar and other IDs are checked, and the register prints in one tap." },
    website: { h: "Your own booking website. No commission", p: "A page with your photos, prices and free dates at pandoratemplates.com/h/your-name. Guests message you on WhatsApp and book direct." },
    profit: { h: "Finally see what each listing really earns", p: "Payouts, platform fees, cleaning, bills and repairs in one place, with profit per listing and a statement your CA will like." },
    sync: { h: "Airbnb, Booking.com and direct bookings in one calendar", p: "Paste your calendar links and bookings arrive on their own. Your caretaker sees today's check-ins and cleaning list on their phone." },
  },
} as const satisfies Record<string, Record<string, Headline> & { main: Headline }>;

export type VariantProduct = keyof typeof AD_VARIANTS;

/** The version to show for ?v= (unknown or missing → "main"). */
export function pickVariant<P extends VariantProduct>(product: P, v: string | null | undefined): { key: string; headline: Headline } {
  const all = AD_VARIANTS[product] as Record<string, Headline>;
  const key = v && Object.prototype.hasOwnProperty.call(all, v) ? v : "main";
  return { key, headline: all[key] };
}

/** The version names for one product, for the Pixel script's data-variants. */
export const variantKeys = (product: VariantProduct) => Object.keys(AD_VARIANTS[product]);
