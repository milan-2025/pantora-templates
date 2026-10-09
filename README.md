# Pandora Templates website

The full pandoratemplates.com site: a multi-product homepage, animated product sales pages (such as `/wedding_planner`), pages the owner builds in the admin (such as `/ultimateweddingplanner`), a blog, checkout with promo codes and affiliate commissions, and a **WordPress-style admin at `/admin`**, so day-to-day changes need no developer.

**Stack:** Next.js 16, Payload CMS 3 (the admin), MongoDB Atlas, Cloudinary for uploads, Tailwind CSS v4, Motion, Brevo (email).

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
cp .env.example .env.local     # set PAYLOAD_SECRET and DATABASE_URI (MongoDB)
npm run seed                   # load the starting content (once per new database)
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
Edit `collections/*` and run `npm run generate` to update types and the admin import map. MongoDB needs no migrations: new fields simply appear.

Use a separate Atlas database (or cluster) for local development, so testing never touches real orders.

### Deploy on Vercel
1. Create a free **MongoDB Atlas** cluster. Under **Network Access**, allow `0.0.0.0/0` (Vercel's servers have changing IPs). Copy the connection string, add a database name (e.g. `/pandora?`), and set it as `DATABASE_URI`. You can also use Vercel's MongoDB Atlas integration (Vercel → Storage), which sets the variable for you.
2. Create a **Cloudinary** account and set `CLOUDINARY_URL` (Dashboard → API Keys → "API environment variable"). Images and videos load from Cloudinary's CDN; paid product files are stored as *private* and only reachable through the paid-order download link. Uploads go straight from the browser to Cloudinary, so large videos aren't limited by Vercel's 4.5 MB request size (Cloudinary's free plan allows up to 10 MB per image/file and 100 MB per video).
3. Set `PAYLOAD_SECRET` and `NEXT_PUBLIC_SITE_URL` (e.g. `https://pandoratemplates.com`; the `www.` version is allowed automatically), plus `ALLOW_MOCK_PAYMENTS=true` for a demo on mock payments.
4. Deploy. Then run the seed once against the production database (`npm run seed` with the production `DATABASE_URI` in `.env.local`), and create the first admin login at `/admin`.
5. Point the pandoratemplates.com domain at the Vercel project. If you change domains later, update `NEXT_PUBLIC_SITE_URL` and redeploy, or admin logins on the new domain will be refused.

### Payments (Razorpay)
Checkout uses **Razorpay** whenever `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are set; without them it runs in demo mode.
1. **Test mode:** use the `rzp_test_…` keys. Checkout shows a "TEST MODE" banner. Pay with UPI ID `success@razorpay` (or `failure@razorpay` to test a failed payment), or an Indian test card such as Visa `4100 2800 0000 1007` / RuPay `6527 6589 0000 1005` (any future expiry, any CVV, any 4–10 digit OTP). Cards like `4111 1111 1111 1111` count as international and are rejected unless international payments are enabled on the Razorpay account.
2. **Webhook (required before launch):** Razorpay Dashboard → Webhooks → Add webhook: URL `https://<your-site>/api/payment/webhook`, events `payment.captured` and `order.paid`, and a secret you choose. Set the same secret as `RAZORPAY_WEBHOOK_SECRET`. This confirms orders and emails the files even if a buyer closes the tab right after paying.
3. **Go live:** complete Razorpay's account activation (KYC), generate **live** keys, replace both keys in Vercel, add the webhook again in **Live mode** (test and live webhooks are separate), and redeploy. The banner disappears automatically with `rzp_live_` keys.

Prices are always calculated on the server, and every payment is confirmed with Razorpay's signature before the order is marked paid. Confirmation is idempotent: the checkout page and the webhook can both confirm the same order without double-emailing or double-counting commission.

### Security notes
- Prices, promo discounts and commissions are always calculated on the server.
- Paid files are private. `/api/download/<orderId>` checks the order is paid, then issues a signed link valid for 10 minutes.
- Orders, affiliates and contact messages can't be read or created through the public API.
- The offer countdown, "X of Y sold" counter and purchase popups use only real data (India's 2023 dark-patterns guidelines prohibit "false urgency").
