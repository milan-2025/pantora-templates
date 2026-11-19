# Pandora Templates website

The full pandoratemplates.com site: a multi-product homepage, animated product sales pages (such as `/wedding_planner`), pages the owner builds in the admin (such as `/ultimateweddingplanner`), a blog, checkout with promo codes and affiliate commissions, and a **WordPress-style admin at `/admin`**, so day-to-day changes need no developer.

**Stack:** Next.js 16, Payload CMS 3 (the admin), MongoDB Atlas, Cloudinary for uploads, Tailwind CSS v4, Motion, Brevo (email).

---

## How to edit your site (for the owner)

Log in at **pandoratemplates.com/admin**. Every change is live a few seconds after you click **Save** or **Publish**.

| I want to… | Go to |
|---|---|
| Change text, prices or images on the wedding planner page | **Shop → Products → The Wedding Planner Sheet**. Each tab (Hero, Pain points, Product tour, Feature highlights, FAQ…) is one section of the page. |
| Change the animated spreadsheet for a product | Product → **Sheet preview** tab: set the file name and formula line, then add up to 5 **Sheet tabs**. Each tab can have big numbers, a table (one row per line, cells separated by `\|`, or paste from Excel), a progress bar and bar/donut charts; only the parts you fill in are shown. Words like Done, Paid, Pending or "In 3 days" in the last column become coloured tags. In **Product tour** and **Feature highlights**, "Sheet tab 1–5" picks which of these tabs to show. A product with no tabs yet shows its "What's included" list. |
| Run an offer or a quick-order bonus | Same product → **Offer** tab. **Offer price:** tick "Offer price is running", set the price, and optionally a fixed end date for everyone. **Quick-order bonus:** tick "Bonus is running", name it, attach the bonus file (or a link) and set the minutes (e.g. 15). Each visitor sees "Order in the next 14:32 to get … free"; orders placed in time get the bonus automatically, and the price never changes. Optionally set **Restart the timer after** (e.g. 1 minute, 1 day) to give a visitor a fresh countdown that long after theirs runs out; leave it empty to never restart. |
| Offer add-ons at checkout (upsells) | Product → **Upsells** tab → **Add Upsell**: pick another shop product, set its special price (₹) and an optional one-line pitch. Buyers see it as a tick-box card above the details form; ticked add-ons are added to the total, any promo code discounts the whole order, and the add-on's files are emailed and shown on the thank-you page. Add-on sales also count on that product's own sales counter and purchase popups. |
| Upload the file buyers get | **Shop → Product files**, then pick it in the product's "Download file" field. For more than one file or link, add rows under **More files & links** (each row: button text + a file, a link, or both). Buyers get them all on the thank-you page and in the email. |
| Make a new page (e.g. `/ultimateweddingplanner`) | **Content → Pages → Create new**. Set the slug (the page address), add sections with the **+** button, click **Publish**. |
| Edit the homepage | **Content → Pages → Home** |
| Write a blog post | **Content → Blog posts → Create new** (it appears at `/blog/<slug>`) |
| Upload images or videos | **Content → Images & videos**, or straight from any image field |
| Show a sales counter | Product → **Offer** tab → **Sales counter**: tick "Show the sales counter". It counts real paid orders on the website (refunds excluded); add genuine earlier sales (WhatsApp/Instagram) under "Real sales made before this website". It stays hidden until it reaches the minimum you set. |
| Add an affiliate | **Shop → Affiliates → Create new**: name, code, customer discount %, commission %. Share `pandoratemplates.com/wedding_planner?ref=CODE`; visitors from that link see the discounted price on the product page, and the code is applied automatically at checkout. |
| See what you owe affiliates | **💰 Affiliate earnings** in the menu. Pay them, then click **Mark as paid**. |
| Manage the online wedding planner (plans, trial, customers) | **Wedding planner** in the menu. See "Online wedding planner" below. |
| See orders | **Shop → Orders** |
| Read contact-form messages | **Inbox → Contact messages** (also emailed to you) |
| Change WhatsApp number, menu, footer links, Meta Pixel | **Settings → Site settings** |
| Add another admin | **Settings → Admin users** |

Tips:
- A page or post saved as **Draft** isn't visible to the public until you click **Publish**.
- Sections with no content are hidden automatically (e.g. Testimonials stays hidden until you add real reviews).
- If a section has no image uploaded, product pages show an animated spreadsheet preview instead.

---

## Stays: property inventory and sharing (`/stays`)

A permanent inventory of your own and collaborating hosts' properties, a public discovery site with search and a map, a host portal, and an admin dashboard that works offline on your phone. Every enquiry goes to your WhatsApp; host details, exact addresses, landing prices and margins never reach guests.

- Guests: **/stays** · Hosts: **/stays/host** · You: **/stays/admin** (same login as /admin)
- Setup, deployment, backups, costs, limitations and the admin guide: **[docs/stays/README.md](docs/stays/README.md)**
- No new environment variables (uploads need `CLOUDINARY_URL`).

---

## Online wedding planner (`/planner`)

The upgrade to the Excel planner: the same guest list, budget, vendors, payments, stay, transport, rituals, shagun and the rest, saved to the cloud, shared with family, on any phone.

### Landing page
First-time visitors to `/planner` (and every ad click) see a landing page: hero, features with real screenshots, family sharing, pricing (read live from **Planner plans**), FAQ and a sticky "Start free trial" button on phones. Signed-in customers skip it and go straight to their planner. Every "Start free" button goes to **`/planner/signup`**; "Sign in" goes to **`/planner/login`** (use these in ads, emails and WhatsApp). Old `/planner#signin` links redirect to `/planner/login`. Code: `planner-app/landing.js` and `landing.css`; screenshots in `public/planner/lp/`.

### How customers use it
1. They open **pandoratemplates.com/planner**, tap "Start free trial", type their email and get a 6-digit code (sent through Brevo, no passwords).
2. They start a **free trial**: an empty plan, the sample data, their filled-in Pandora Excel, or what they already typed on that device.
3. Everything saves automatically. Other devices and family members see changes within a few seconds; edits to different rows never overwrite each other.
4. **Upgrade** opens Razorpay from inside the planner. The plan switches as soon as payment is confirmed (also via the webhook).
5. On a paid plan the owner can invite family under **Sharing** ("Can edit" or "View only"). Each person signs in with their own email.
6. **Activity & Restore** shows who changed what, and can put the planner back to an earlier restore point (kept automatically every 30 minutes of editing, before imports and before deleting 5+ rows).
7. Every list has a **⚙ Columns** button: show/hide, rename, reorder, and add their own columns (text, number, date, dropdown, yes/no). Dropdown choices are editable under **Setup & Data**.
8. On phones, lists become tap-to-open cards; no sideways scrolling.
9. **Features** (Account menu) switches pages and tools on or off for the whole planner, with "Just the essentials", "Standard" and "Everything" presets. Switching off only hides a page; nothing is deleted. Every existing page is on by default; Wedding-day mode, Arrivals and the run sheet link start off.
10. **Contacts** is one phone book (family & team with phone numbers, vendors, hotels, transport, guests) with call and WhatsApp buttons. Every phone number in the planner has them too. Starred (⭐) contacts show first, in Wedding-day mode, in the Family Handout and on the shared run sheet.
11. **WhatsApp messages** (Setup & Data): invitation, RSVP reminder, stay & pickup details, thank-you and vendor payment note, each editable, with placeholders like `{name}` and `{hotel}`.
12. **Phone checks**: numbers are tidied as typed (`098290-12345` → `98290 12345`), wrong-looking ones are flagged, and possible duplicate guests are listed on the Guest List.
13. **Search** (🔍 or Ctrl+K) finds any guest, vendor, task, payment or contact. **Undo** (↶ or Ctrl+Z) reverses the last changes.
14. **Wedding-day mode** shows the current function, what's next on the run sheet and one-tap calls; **Arrivals** ticks guests off as they arrive; **Share run sheet by link** gives a view-only page at `/planner/share/<code>` (run sheet and starred contacts only, no guests or money). The couple can turn the link off or replace it at any time.
15. **Guest and vendor details**: tap a guest's or vendor's name (or › next to it, or "All details" on phones) on any screen: Guest List, rooming and pickup lists, Shagun, Payments, Run Sheet, Contacts, Arrivals, search. A guest shows their number, RSVP, functions they're invited to, stay, pickup, family and shagun; a vendor shows quoted / negotiated / paid / left to pay, every payment, their run-sheet jobs and tasks, and the other quotes for the same job.
16. **Quick start tour**: a skippable tour the first time someone opens a planner on a device (remembered per email on that device). Replay it from Setup & Data or Account.
17. **Works offline and installs like an app**: once the planner has opened on a device, it opens there without internet and syncs changes when back online ("Install the app" in the sidebar, or Add to Home Screen).

When a trial or plan ends, the planner turns **read-only**: nothing is deleted, it can still be viewed and exported, and editing resumes the moment they upgrade or renew. "Explore the sample planner" works without an account and stays on that device.

### Running it from /admin (Wedding planner)
| I want to… | Do this |
|---|---|
| Change trial length (7 or 14 days) or trial limits | **Planner plans → Free trial**: "Valid for (days)" and the Limits. |
| Change prices, limits, how many family members a plan allows | **Planner plans → (plan)**. Empty limit = unlimited. Applies at once to everyone on that plan. |
| Add a new plan / stop selling one | **Planner plans → Create new**, or untick "Show on the upgrade screen". Keep exactly one plan ticked as the free trial. |
| Change a customer's plan | **Customer planners → (customer)** → pick the plan → Save. Validity restarts from today unless you also type a "Valid until" date. |
| Extend or shorten validity | Same page → change **Valid until** → Save. |
| Give someone extra family seats | Add them under **Collaborators** on that customer's planner. |
| Pause a customer | Set **Status** to Suspended (read-only). |
| See a customer's planner (support) | **Customer planners → View** (opens it read-only for 2 hours). |
| See who changed what | **Planner activity**. |
| Add the Meta Pixel | **Planner landing page → Meta Pixel ID**. Sends PageView, Lead (code requested), StartTrial (planner created), Purchase (plan paid) and Contact (WhatsApp tap). Empty = off. |
| Change the WhatsApp button | **Planner landing page → WhatsApp number** (country code, digits only). Empty hides it. |
| Show testimonials | **Planner landing page → Testimonials**: replace a sample with a real customer's words and tick **Show on page**. The section is hidden while none are ticked. |
| See which ad brought a customer | **Customer planners → (customer) → Came from** (utm_source / campaign / content of their first visit). |

The starting plans (Free trial 14 days/30 guests, Family ₹1,499, Grand ₹2,999) are created automatically the first time the planner is opened; edit them freely.

No new environment variables: the planner uses `PAYLOAD_SECRET`, `BREVO_API_KEY` (sign-in codes and invites), the Razorpay keys and the existing Razorpay webhook. Without `BREVO_API_KEY`, in development the sign-in code is filled in for you.

### For developers
- App source: `planner-app/` (plain JS + CSS, no build tools). After editing, run `npm run build-planner` to regenerate `public/planner/index.html` and the offline worker `public/planner/sw.js` (its version changes with every build, so phones pick up updates), and commit them.
- Offline: `planner-app/sw.js` caches the page, its files and fonts (never `/api`). The app keeps the last-opened planner in `localStorage` and opens it from there when the server can't be reached.
- Run sheet link: `shareToken` on the planner, `POST /api/planner/planners/:id/share`, page `app/planner/share/[token]/route.ts`. What it shows is decided in `runSheetView` (`lib/planner/core.ts`).
- Server: `lib/planner/core.ts` (merge, limits, tokens; pure and unit-tested), `lib/planner/server.ts` (Payload), routes in `app/api/planner/*`.
- Collections: `planners`, `planner-plans`, `planner-history`, `planner-logins` (hidden).
- Sync model: the app sends row-level changes (`{c, id, r}` / `{k, v}` / `{replace}`) with each save; the server applies them under an optimistic lock on `rev` and logs them, so other devices fetch just the changes since their last `rev` (polling every 7 s while visible). Plan limits and read-only states are enforced on the server.
- Tests: `tests/planner.test.ts` (`npm test`).

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

### Upgrading an existing database
The animated sheet preview moved from code into the admin. Run `npm run fill-preview` once against an existing database (production `DATABASE_URI` in `.env.local`) to give the Wedding Planner its preview back; it changes nothing if the product already has one. Don't re-run `npm run seed` on a live database: it overwrites the starting content.

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
- The offer countdown and purchase popups only ever show real data: the bonus timer counts to when that visitor's bonus window genuinely closes (enforced by a signed, server-checked cookie; late orders don't get the bonus), and popups show real paid orders from the last 30 days (first name and city only). India's 2023 dark-patterns guidelines prohibit "false urgency" and fake social proof.
