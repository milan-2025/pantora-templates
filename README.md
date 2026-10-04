# Pandora Templates website

The full pandoratemplates.com site: a multi-product homepage, animated product sales pages (such as `/wedding_planner`), pages the owner builds in the admin (such as `/ultimateweddingplanner`), a blog, checkout with promo codes and affiliate commissions, and a **WordPress-style admin at `/admin`**, so day-to-day changes need no developer.

**Stack:** Next.js 16, Payload CMS 3 (the admin), SQLite locally / Turso in production, Vercel Blob for uploads, Tailwind CSS v4, Motion, Resend.

---

## How to edit your site (for the owner)

Log in at **pandoratemplates.com/admin**. Every change is live a few seconds after you click **Save** or **Publish**.

| I want to… | Go to |
|---|---|
| Change text, prices or images on the wedding planner page | **Shop → Products → The Wedding Planner Sheet**. Each tab (Hero, Pain points, Product tour, Feature highlights, FAQ…) is one section of the page. |
| Run a limited-time offer | Same product → **Offer** tab: tick "Offer is running", set the offer price, the end date and (optionally) the number of sales at that price. The countdown and "X of Y sold" bar appear automatically, and the price goes back to normal when the offer ends. |
| Upload the file buyers get | **Shop → Product files**, then pick it in the product's "Download file" field. |
| Make a new page (e.g. `/ultimateweddingplanner`) | **Content → Pages → Create new**. Set the slug (the page address), add sections with the **+** button, click **Publish**. |
| Edit the homepage | **Content → Pages → Home** |
| Write a blog post | **Content → Blog posts → Create new** (it appears at `/blog/<slug>`) |
| Upload images or videos | **Content → Images & videos**, or straight from any image field |
| Add an affiliate | **Shop → Affiliates → Create new**: name, code, customer discount %, commission %. Share `pandoratemplates.com/wedding_planner?ref=CODE`; the code is applied automatically at checkout. |
| See what you owe affiliates | **💰 Affiliate earnings** in the menu. Pay them, then click **Mark as paid**. |
| See orders | **Shop → Orders** |
| Read contact-form messages | **Inbox → Contact messages** (also emailed to you) |
| Change WhatsApp number, menu, footer links, Meta Pixel | **Settings → Site settings** |
| Add another admin | **Settings → Admin users** |

Tips:
- A page or post saved as **Draft** isn't visible to the public until you click **Publish**.
- Sections with no content are hidden automatically (e.g. Testimonials stays hidden until you add real reviews).
- If a section has no image uploaded, product pages show an animated spreadsheet preview instead.

---

## Developer guide

### Run locally
```bash
npm install
cp .env.example .env.local     # set PAYLOAD_SECRET at minimum
npm run payload migrate        # create the local database
npm run seed                   # load the starting content
npm run dev                    # http://localhost:3000 (admin at /admin)
```

### Where things live
| What | Where |
|---|---|
| Admin config (collections, fields, globals) | `payload.config.ts`, `collections/*`, `globals/*`, `blocks/*` |
| Product sales page | `components/landing/ProductLanding.tsx` + `components/sections/*` |
| Page-builder block renderers | `components/blocks/RenderBlocks.tsx` |
| Routes | `app/(frontend)/` (site), `app/(payload)/` (admin), `app/api/*` (checkout, contact, downloads, live data) |
| Pricing, offers and promo codes (server-side only) | `lib/pricing.ts` |
| Payment gateway abstraction | `lib/payments.ts` |
| Emails | `lib/email.ts` |
| Starting content | `scripts/seed.ts` |

### Changing the data model
1. Edit `collections/*` and run `npm run generate` to update types.
2. Run `npm run payload migrate:create <name>` and commit the new file in `migrations/`.
3. Vercel applies it on the next deploy (`vercel-build` runs `payload migrate` first).

### Deploy on Vercel
1. Add **Turso** (Vercel → Storage / Marketplace) and set `DATABASE_URI` + `DATABASE_AUTH_TOKEN`.
2. Add **Vercel Blob** (Vercel → Storage); `BLOB_READ_WRITE_TOKEN` is set automatically.
3. Set `PAYLOAD_SECRET` and `NEXT_PUBLIC_SITE_URL`, plus `ALLOW_MOCK_PAYMENTS=true` for a demo on mock payments.
4. Deploy. Vercel runs `npm run vercel-build` (migrations, then build). Then run the seed once against the production database (`npm run seed` with the production env vars), and create the first admin login at `/admin`.
5. Point the pandoratemplates.com domain at the Vercel project.

### Going live with real payments
Payments use a mock provider. To connect Razorpay or Cashfree:
1. Implement a provider in `lib/payments.ts` (a Razorpay outline is included) and set `PAYMENT_PROVIDER`.
2. In `app/(frontend)/checkout/CheckoutForm.tsx`, at `// GATEWAY CHECKOUT GOES HERE`, open the gateway's checkout with `order.clientData` and pass its response to `/api/payment/verify`.
3. Move order confirmation and delivery to the gateway's webhook, so buyers who close the tab still get their email.

### Security notes
- Prices, promo discounts and commissions are always calculated on the server.
- Paid files are private. `/api/download/<orderId>` checks the order is paid, then issues a signed link valid for 10 minutes.
- Orders, affiliates and contact messages can't be read or created through the public API.
- The offer countdown, "X of Y sold" counter and purchase popups use only real data (India's 2023 dark-patterns guidelines prohibit "false urgency").
