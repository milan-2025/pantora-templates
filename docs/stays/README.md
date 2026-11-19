# Stays: property inventory, discovery and sharing

A module inside the existing Pandora Templates website. It keeps every property (your own and collaborating hosts') in one permanent, searchable inventory with its photos and videos, gives guests a public discovery site, and sends every enquiry to **your** WhatsApp. Host identities, addresses, exact locations, Airbnb links, landing prices and margins never reach guests.

| Who | Where | Sign-in |
|---|---|---|
| Guests | `/stays` (home), `/stays/search` (list + map), `/stay/<title>-<ID>` (property), `/stay/s/<token>` (share links) | none |
| Hosts | `/stays/host` | email + password (own account) |
| You (admin) | `/stays/admin` (installable app, works offline) | the existing website admin login (`/admin`) |
| You, browsing the guest site with private details | any guest page after **Browse site as admin** in the dashboard | admin login **and** the admin-view switch |

---

## 1. Repository audit (summary)

- **Stack found:** Next.js 16 (App Router, webpack build), Payload CMS 3 for the site admin, MongoDB (Atlas) through Payload, Cloudinary for files, Brevo for email, Tailwind CSS v4, deployed on Vercel.
- **Existing patterns reused:** the CRM and planner already keep their own MongoDB collections through Payload's connection, expose API routes under `app/api/*`, hash passwords with scrypt, sign session cookies with `PAYLOAD_SECRET`, upload straight from the browser to Cloudinary with server-signed parameters, and test API routes against an in-memory MongoDB fake (`tests/fakeMongo.ts`). Stays follows the same patterns, so it adds **no new infrastructure and no new paid services**.
- **Admin login:** Payload's admin users *are* the stays administrators; there is no second admin account to manage.
- **Isolation:** stays pages live in their own route group (`app/(stays)`) with their own layout and stylesheet (same brand colours and fonts), and their data lives in collections prefixed `stay_`. The shop, CRM, planner, invites and Payload collections are untouched. The only shared files changed: `next.config.ts` (privacy headers), `lib/cms/access.ts` (reserves the `stays` / `stay` slugs), plus a new site-wide `sitemap.xml` and `robots.txt`.
- **Why not Supabase/PostgreSQL:** the site already runs on MongoDB + Cloudinary with working auth, storage and deployment; adding a second database and auth system would double the operational work for no gain.

## 2. Architecture

```
app/(stays)/                     public pages, host portal, admin dashboard (own root layout + stays.css)
app/api/stays/public/route.ts    guest API (no sign-in): search, map, suggestions, enquiry-click log
app/api/stays/host/route.ts      host API: account, own properties, media, submit for review
app/api/stays/admin/route.ts     admin API: everything else (checks the /admin login on every request)
lib/stays/                       logic: constants, core (IDs, money, margins, coords, WhatsApp), property (input cleaning),
                                 workflow, media, views (what each role may see), search, server (DB, auth, audit), actions, pages, seo
components/stays/                UI: public pieces, map (Leaflet), enquiry dialog, gallery, host app, admin app, offline store
public/stays/                    admin service worker, web-app manifest, icons
tests/stays-*.test.ts            69 automated tests
```

**Privacy is enforced on the server, not by hiding things in the browser.** Every response is built from a whitelist in `lib/stays/views.ts`:

| | Guest | Host (own properties only) | Admin |
|---|---|---|---|
| Title, description, rooms, amenities, rules, photos | ✓ | ✓ | ✓ |
| Locality, society (unless hidden), city | ✓ | ✓ | ✓ |
| Full address, street, PIN, exact pin, Maps link | ✗ (approximate area only) | ✓ | ✓ |
| Listing (guest) price | only when shown | ✗ | ✓ |
| Landing price (host payout) | ✗ | ✓ (their own) | ✓ |
| Margin | ✗ | ✗ | ✓ |
| Airbnb link, host contact, caretaker contact, notes | ✗ | own link/notes/caretaker | ✓ |

Hosts never see listing prices because that would let them work out your margin.

**Admin browsing view:** the dashboard's *Browse site as admin* (or *View as admin* on a property) sets a cookie and opens the guest site. While it is on, and only for a request that also carries a valid admin login, pages and search show every property (drafts, unlisted, private), and each card and property page adds the host's name and number, the caretaker contact with one-tap WhatsApp/call buttons, the exact address with a Directions button, the Airbnb link, private notes, landing prices and margins. The cookie alone reveals nothing; these responses are marked `private, no-store` so no cache can keep them; your own enquiry-button clicks aren't logged. *Exit admin view* in the purple bar turns it off (it also expires after 12 hours).

**Approximate locations:** the public position is moved 250–650 m from the real one in a direction fixed per property (derived from `PAYLOAD_SECRET`, so it can't be reversed or averaged out), rounded to ~110 m, and drawn as an area circle. Exact coordinates are never sent to guests.

### Data (MongoDB collections)

| Collection | Holds |
|---|---|
| `stay_properties` | One document per property: IDs, custom link words (`slugText`), rooms (`roomList`: name, description, amenities; photos point to a room with `roomId`), caretaker contact, details, location (exact + approximate), rooms, amenities, features, policies, pricing (`landing`, `listing`), private fields, media list, status, visibility, review notes, pending host edits, timestamps (`createdAt`, `updatedAt`, `submittedAt`, `approvedAt`, `publishedAt`, `lastVerifiedAt`) |
| `stay_hosts` | Hosts: host ID (H-0001), contact, payout details, notes, status, password hash, invite token hash |
| `stay_shares` | Share links: unguessable token, property, with/without price, views, revoked |
| `stay_enquiries` | Enquiry log: button clicks (no personal data) and enquiries you record |
| `stay_amenities` | Amenity list (defaults + your own) |
| `stay_settings` | Settings (one document) |
| `stay_counters` | ID counters per prefix (IDs are never reused) |
| `stay_audit` | Audit log of sensitive changes |
| `stay_notifications` | Dashboard alerts (new submissions, host edits, publish requests) |
| `stay_migrations` | Which migration steps have run |

Indexes include a **unique index on property ID** and on host email. Rooms, pricing, location and media are embedded in the property document (MongoDB's natural shape) rather than separate tables.

**Migrations:** MongoDB has no fixed table structure, so migrations (in `lib/stays/server.ts`, `STEPS`) create indexes and starting data and reshape stored documents if the format ever changes. Each step runs once per database and is recorded in `stay_migrations`. Add new steps at the end; never edit a step that has shipped.

**Saved-offline listings** live on the admin's device (IndexedDB), not in the database, by design.

## 3. Setup (local)

```bash
npm install
cp .env.example .env.local     # PAYLOAD_SECRET, DATABASE_URI, and CLOUDINARY_URL for uploads
npm run dev
```

1. Open `/admin` and create (or use) your admin login.
2. Open `/stays/admin`. Settings → check the WhatsApp number (default **8437512120**), website name and templates.
3. Add a property (`+ Add property`) and publish it, then visit `/stays`.

No new environment variables are needed. Stays uses:

| Variable | Used for | Without it |
|---|---|---|
| `DATABASE_URI` | all data | nothing works |
| `PAYLOAD_SECRET` | host sessions, share/approximate-location secrets, admin login | insecure default (dev only) |
| `NEXT_PUBLIC_SITE_URL` | share-link and sitemap addresses | uses the request's address |
| `CLOUDINARY_URL` | photo/video uploads | uploads are refused with a clear message; everything else works |
| `BREVO_API_KEY` | email alert to you on new submissions | alerts only appear in the dashboard |

Maps use free OpenStreetMap tiles and need no key. To use another tile provider, change the tile URL in Settings → Map (keys go in the URL your provider gives you).

## 4. Deployment

Same as the rest of the site (Vercel + MongoDB Atlas + Cloudinary; see the main README). After deploying:

1. Make sure `CLOUDINARY_URL` is set in Vercel (Project → Settings → Environment Variables), then redeploy.
2. Open `/stays/admin` once; the first request creates the indexes and default amenities automatically.
3. Submit `https://<your-site>/sitemap.xml` in Google Search Console (optional).
4. On your phone, open `/stays/admin` and "Add to Home screen" to install the dashboard app.

## 5. Backups and recovery

- **Database:** MongoDB Atlas → your cluster → Backup. Free (M0) clusters have no automatic backups, so either upgrade to a paid tier with Cloud Backup (continuous + point-in-time restore) or run a weekly export:
  `mongodump --uri "$DATABASE_URI" --out backup-$(date +%F)` (restore with `mongorestore --uri ... backup-YYYY-MM-DD`). For stays only: add `--collection` per `stay_*` collection or use `--nsInclude='<db>.stay_*'`.
- **Photos and videos:** stored permanently in Cloudinary under `stays/<property id>/`. They don't depend on WhatsApp, the host's phone, or the host staying on the platform. Cloudinary keeps them until deleted; for an extra copy, use Cloudinary's backup add-on (paid) or download the folder periodically.
- **Mistakes:** prefer **Archive** over Delete (archived properties keep everything and can be restored). Every sensitive change is in the Activity log with before/after values, so a wrong price or address can be put back by hand.

## 6. External services and costs

| Service | What for | Cost |
|---|---|---|
| MongoDB Atlas | database (already used) | free M0 tier works for thousands of properties; backups need a paid tier (from about US$9/month) |
| Cloudinary | photo/video storage, thumbnails, WebP/AVIF, video posters (already used) | free plan: 25 monthly credits (≈25 GB storage or bandwidth), 10 MB per photo, 100 MB per video; paid from about US$89/month |
| OpenStreetMap tiles | maps | free under the [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) (light, non-bulk use with attribution). For heavy traffic switch to a free-tier provider such as MapTiler or Stadia in Settings → Map |
| WhatsApp click-to-chat (`wa.me`) | enquiries | free |
| Brevo | email alerts (already used) | free tier 300 emails/day |
| Vercel | hosting (already used) | unchanged |

## 7. Tests

`npm test` runs everything (no database needed). The stays suites:

- `tests/stays-core.test.ts` (27 tests): IDs, slugs, margins, money, Google Maps links, approximate positions, WhatsApp numbers/messages/encoding, input whitelists per role, workflow rules, media checks, views never leaking, search.
- `tests/stays-api.test.ts` (53 tests): the real API routes end to end, covering the brief's mandatory cases 1–20 and 22 (admin manages hosts and invites; host submits; approval required; host isolation; admin edits; unique permanent IDs; margins; landing price and margin hidden from guests and hosts; share with/without price; private/unlisted rules; no exact address anywhere public; WhatsApp number, property ID, dates and guests; approximate vs exact maps; media persistence and forged-upload rejection; offline sync with conflict detection), plus access control, cross-site request blocking, audit log and combined filters.

Browser checks (run against a production build with a real MongoDB; scripts not committed because they need a database and sample data): 59 checks, including custom links and redirects, room-by-room pages, white guest pages, and the admin browsing view (on/off, drafts visible, host/caretaker one-tap links, landing and margin, nothing shown without both the login and the switch). The original 34 checks across desktop and phone sizes covering public pages, page-source privacy, the Check Availability → WhatsApp message, hidden prices, unlisted 404s, canonical redirects, sitemap/robots, no sideways scrolling on phones, no service worker on guest devices, admin overview/table/editor/share/pricing/map, **offline open + offline edit + sync back** (case 21–22), and host isolation (case 23: mobile and desktop layouts).

## 8. Known limitations

- **WhatsApp:** click-to-chat can't tell the website who messaged or what they wrote. The enquiry log therefore shows *button clicks* (someone pressed a button and WhatsApp opened) separately from enquiries you record yourself. Capturing real messages automatically would need the paid WhatsApp Business API.
- **Uploads need Cloudinary:** without `CLOUDINARY_URL`, uploads are refused (there's no local fallback, because Vercel can't keep uploaded files).
- **Forgotten host passwords:** there is no self-service "forgot password" email yet. In Hosts, press **Reset link** and send it to the host on WhatsApp.
- **Short Google Maps links** (`maps.app.goo.gl`) are followed on the server to find the pin; if Google changes that, paste the long link or tap the map.
- **Offline editing** covers title, short description, description, availability and guest prices. Photos, addresses and host details can't be edited offline (private data isn't stored on the device). Background sync works in Chrome/Android; on iPhone, queued edits are sent the next time the app is opened online.
- **Rate limiting** is per server instance (in memory), like the rest of the site; it stops casual abuse, not a determined attack.
- **Search** filters the listed properties in memory (cached 30 s per server), which is fast up to several thousand properties; beyond that, move the filters into MongoDB queries.
- **Seasonal/date-based pricing** isn't built yet; the pricing structure (`pricing.landing` / `pricing.listing`) leaves room for a `seasonal` list next to them.
- Share links for a **public** property can hide the price, but the property's normal public page still follows its own "show price" setting. Use **Unlisted** if a property's price must only ever go out through links you control.

---

# Administrator guide

### Add your own property
**+ Add property** → Basics (title, type) → Ownership: *My own property* → Location (address, locality, city; paste the Google Maps link or tap the map, or press *I'm at the property* when you're there) → Rooms, Amenities, Standout features, House rules → **Pricing and margin**: landing price (what the owner gets; for your own flat, your cost) and listing price (what guests pay). The margin is worked out as you type. → **Create property**. Then add photos (drag them in, or *Choose files* / *Take a photo* on your phone; ★ makes a photo the cover; arrows reorder) → **Publish**.

Every property gets a permanent ID: `LAC-0001…` for yours, `HST-0001…` for hosts' (prefixes in Settings). IDs are never reused, even after deletion.

### Custom links
In the property's **Basics**, fill in **Custom link words** (e.g. `sea view mohali`). The address becomes `/stay/sea-view-mohali-LAC-0001`; the ID always stays at the end so links never clash. Old links keep working and redirect to the new one.

### Rooms and room-tagged photos
In **Room by room**, add rooms (one tap for Living room, Bedroom 1, Kitchen…, or **+ Add custom room** for anything else, e.g. *Rooftop jacuzzi deck*), each with a short description and amenities. Then in **Photos and videos**, pick each photo's room from the drop-down (and optionally press **Sort photos by room**). Hosts can do the same in their portal.

What guests see (modelled on Airbnb):
- **Top of the page:** your photos in **your own order** (cover first). Phones get a full-width swipe carousel with next/previous arrows and a "2 / 12" counter; larger screens get one large photo plus four, and **Show all photos**.
- **Opening the photos** shows the **photo tour**, room by room: room thumbnails at the top (tap to jump), then each room's name, description, amenities and photos; photos without a room come last under "Additional photos". Tapping a photo opens a full-screen viewer (swipe, arrows or keyboard) that shows which room it is ("Master bedroom · 2/4").
- **Room by room** (below the description): a row of room cards you can swipe or scroll with arrows; tapping one opens the photo tour at that room.
- **Property cards** on the home and search pages can be swiped through (arrows on hover on a computer, dots underneath).

### Contact hosts and caretakers in one tap
Save the host's phone and WhatsApp in **Hosts**, and an optional caretaker/on-site contact on each property (*Private details*). WhatsApp and Call buttons appear in the Hosts list, the Properties table, at the top of each property, and in the admin browsing view. These numbers are never shown to guests.

### Browse the site as admin (for answering enquiries)
Menu → **Browse site as admin**, or **View as admin** on a property. You get the normal guest site plus a purple *Admin view* bar, and every property (including drafts, unlisted and private) shows the host's name and number, the caretaker, the exact address with Directions, the Airbnb link, your notes, landing price and margin, with one-tap WhatsApp/Call. You can also search by host name or number. Press **Exit admin view** to go back to what guests see.

### Invite hosts
**Hosts → Add host** (name, phone, email, payout details, private notes) → **Invite** → *Send on WhatsApp*. The link lets them set a password at `/stays/host` (valid 14 days, single use). Hosts can also sign up themselves at `/stays/host`. Pausing a host signs them out everywhere; their properties and photos stay.

### Approve host listings
New submissions appear on **Overview** ("waiting for approval") and you get an email if Brevo is set up. Open the property → check details and photos → **Approve** and **Publish**, or **Request changes** / **Reject** with a message the host sees. When a host edits a live listing, their edits wait in a yellow box on the property ("Apply changes" / "Discard"); new host photos wait as *Awaiting approval*, and host removals arrive as *Removal requested*. A host can never approve or publish.

### Manage pricing
Each property: **Pricing and margin**. The **Pricing** screen lists every property with landing, listing, weekday/weekend margin, margin %, weekly potential, and filters for *Missing prices* and *Losing money*.

### Share properties with or without prices
Open the property → **Share with a guest** → **Share with price** or **Share without price**. The link is copied; use *Preview* or *WhatsApp*. The price choice is enforced on the server (a no-price link doesn't contain the price at all). Each link counts views and can be **turned off** at any time. Visibility: **Public** (search, map, Google), **Unlisted** (only through share links), **Private** (only you and the host; links don't work).

### Manage enquiries
**Enquiries** shows WhatsApp button clicks (property, dates and guest numbers if they used *Check Availability*) and enquiries you **record** yourself (guest name, number, channel). Set a status (new → contacted → quoted → booked / lost) and keep notes.

### Save listings offline
On your phone, open `/stays/admin` and add it to your home screen. Then **Save offline** on a property, or select many in **Properties** → *Save offline on this device*. **Saved offline** works without internet: browse details, prices and photos, copy links, and edit guest-facing details. Edits show *Saved locally* → *Pending sync* → *Synchronised*; if someone changed the same field meanwhile, you choose *Keep mine* or *Keep server's*. **Sign out** in the menu clears the device.
