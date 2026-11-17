# Real estate mode (one-click, per company)

Every company starts as a normal CRM. An admin can switch on **Real estate mode** in one click:
**Menu → 🏠 Real estate mode: Off → turn on.** The page reloads with the real estate features unlocked.
Switching it off goes back to a normal CRM. **Nothing is deleted**: projects, units and lead fields come back when it is turned on again.
Your platform admin screen can also set the mode for any company.

## What turns on
- **🏢 Properties & inventory** (`/CRM/properties.html`): projects, a unit grid with status colours, add one unit, add many (range) or import a CSV, search and filter.
- **Unit statuses:** Available, On hold (auto-expires), Blocked, Booked, Sold.
- **Holds:** any team member can hold an available unit for a lead (default 48h, set per project). Expired holds free themselves.
  Only the person who placed a hold, or an admin, can release it. Two people cannot hold the same unit.
- **Bookings (admin):** mark a unit booked/sold for a lead; the lead moves to *Booked* and shows the unit.
- **Lead stages:** adds *Site visit scheduled*, *Site visit done*, *Negotiation*, *Booked* to the normal stages.
- **Lead fields:** project interested in, budget, type/BHK (also available as columns).

## Property IDs, photos and map
- Every project gets a **Property ID** (PR-001, PR-002 …), numbered per company. Older projects get one automatically the first time Properties is opened. IDs cannot be edited.
- **Leads ↔ property:** pick the property on a lead (add form or lead detail). Booking a unit, a public-page enquiry or a partner registration links the lead automatically. Older leads with a typed project name are matched by name until someone picks the property.
- **Leads screen:** filter by property (or "No property"), sort *All leads* by Property ID, and see the Property ID on each lead card. Saved views remember the property filter. Links: `/CRM/?property=<project id>` opens the filtered list, `/CRM/?lead=<lead id>` opens one lead.
- **Properties screen:** find a project by Property ID or name; each project has a **Leads** tab listing every lead for it (agents see their own, partners their own customers), with a button to open the filtered Leads screen.
- **Unit IDs:** every unit gets an ID made of its Property ID plus a unit number, e.g. `PR-001-U007`. Older units get one automatically; IDs never change, even if the flat number is edited.
- **Leads ↔ unit:** pick the unit on a lead (it also sets the property). Booking a unit links the lead to it. Changing a lead's property drops a unit from the old property; renaming a unit updates its leads; deleting a unit or project clears the links.
- **Leads screen:** when a property is selected, a second filter narrows to one unit (or "No unit"). *By Property / Unit ID* sorts by property, then unit. Search finds Property and Unit IDs. `/CRM/?unit=<unit id>` opens the filtered list.
- **Properties screen:** unit tiles show the unit ID and how many leads picked it; the unit sheet lists those leads. The find box accepts a unit ID (e.g. PR-001-U003) and opens that unit.
- **Photos:** up to 12 per project (Properties → Edit). Upload from phone/computer (direct to Cloudinary, signed by the server, images only, into `crm/<company>/projects/<project>`; needs `CLOUDINARY_URL`) or paste https links. ★ makes a photo the cover. Photos show on the public page as a gallery.
- **Google Maps link:** only real Google Maps links are accepted (maps.app.goo.gl, google.com/maps …). Shown as a button in Properties and on the public page.

## Sharing with clients: unit pages and the whole catalogue
- **Single unit:** Properties → tap a unit → *Share this unit* (copy link, WhatsApp, preview). The page `/unit/<id>` shows the unit (type, area, floor, price, Unit ID, status), project photos, the unit's and project's videos, location and an "Ask about this unit" form. Enquiries become leads linked to that unit (source "Unit page"). Booked or sold units say "No longer available" (no price) and point to the project. Buyer and hold details are never shown.
- **Whole catalogue:** Properties → *Share your whole catalogue*. `/catalogue/<id>` lists every **published** project (cover, location, starting price, available types) and links to each project page. Unit numbers are not listed.
- Units and the catalogue can only be shared for projects whose public page is published. Every link carries the sharer's `ref`, so enquiries are credited to them (partners included). Views and enquiries are counted per unit.
- All public pages go offline if real estate mode is switched off or the subscription ends.

## YouTube videos
- Up to 10 YouTube links per project (Edit project) and per unit (Edit unit), one per line. Watch, youtu.be, Shorts, Live and embed links work; anything else is dropped. Videos play on the public pages through YouTube's privacy-enhanced player (no cookies until play).

## Private unit documents
- Properties → unit → **🔒 Documents**: upload agreements, KYC, floor plans, receipts (PDF, Word, Excel, images, PowerPoint, DWG, ZIP, up to 10 MB each, 20 per unit).
- Files are stored as **private** files in Cloudinary under `crm/<company>/units/<unit>/docs`. Uploads are signed by the server and the result is verified before it is saved. Files open only from the CRM through a signed link that expires in 5 minutes.
- Visible to the company's admins and agents. Never shown to channel partners, other companies, or on any public page. Admins (or the person who uploaded) can delete; deleting a unit or project deletes its files too. Needs `CLOUDINARY_URL`.

## Pinned notes (normal and real estate mode)
- Each lead can have one **pinned note**, shown at the top of the lead and on its card (even when Notes are switched off). Add it with *📌 Add pinned note*, edit it, or unpin it; or tap 📌 on any note to pin it.
- Every note in the history can be edited with ✏️ (admins: any note; agents: their own). Edited notes are marked "edited by …". Channel partners can read a pinned note but not change notes.

## Site visits (menu: 📍 Site visits)
- Schedule a visit for a lead (project, optional unit, time). Early-stage leads move to *Site visit scheduled*; later stages never move backwards.
- Mark done with an outcome (interested, still thinking, not interested, did not come) and feedback. The lead moves to *Site visit done*, a note is added, and "not interested" marks it Cold. A no-show keeps the stage and can be rescheduled.
- Tabs: Today, Needs update, Upcoming, Done. Agents see their own leads' visits, admins see everyone's. One-tap call and WhatsApp.
- Visits are stored on the lead as appointments of type "Site visit", so they also appear in the existing calendar and "today" lists.

## Channel partners and commissions (menu: 🤝 Partners & commissions)
- Admins add **partners** (a login with a limited view). Partners do not use a sales seat and never get leads assigned.
- A partner registers customers on the normal Leads screen. **First registration wins**: a phone number already in the CRM is refused. New partner leads go to the sales team round-robin; the partner keeps attribution and sees only their own customers, the project list and availability (not who holds units).
- Partners cannot change stage, owner or attribution. Only an admin can change a lead's partner (lead detail → Channel partner).
- **Commission rates:** per project (Properties → Edit project → Partner commission %), optionally overridden per partner. When an admin books a unit for a partner's lead, a *pending* commission is created (sale value x rate). Admins approve, mark paid, edit the amount, or cancel. Releasing a booked unit cancels unpaid commissions; paid ones are kept.
- GST and TDS on payouts are **not** calculated yet (confirm rules with your CA first).

## Public project page
- Properties → Edit project → **Publish this project's public page**. Add about text, amenities, a cover image link (https) and a contact number.
- The link looks like `/property/<id>?ref=<your id>`. Use **Copy page link** or **Share on WhatsApp**: each team member or partner gets their own `ref`, so enquiries are credited to them.
- The page shows the project, starting price, available units grouped by type (no unit numbers or buyers) and a callback form. Submissions create a lead (source "Project page"); repeat enquiries add a note instead of a duplicate. Spam is limited (hidden trap field, 5 enquiries/hour per visitor).
- The page goes offline if real estate mode is switched off, the project is unpublished, or the subscription ends.

## Reports (menu: 📊 Reports, admins)
Leads received in the chosen period (7/30/90 days or all time) followed through the funnel: sources, projects (units and page views/enquiries), sales team and partners. A lead's furthest stage is taken from its current stage and its site visits; leads marked Lost keep credit only for visits they had.

## Rules built in
- Every project and unit belongs to one company; every query is scoped to it (see `tests/crm-api.test.ts`).
- Real estate endpoints return 403 when the company's mode is off.
- Trial/expired companies are read-only, including inventory and the mode switch.
- Plan unit limits (`UNIT_LIMITS` in `lib/crm/realestate.ts`): trial 200, starter 500, growth 5,000.

## Data (MongoDB)
`crm_workspaces.mode` (`"general"` or `"realestate"`), `crm_projects`, `crm_units` (unique per company + project + unit number), `crm_commissions`. Partners are `crm_users` with role `partner`.

## Code map
- Pure logic + tests: `lib/crm/realestate.ts`, `tests/realestate.test.ts`
- API: `app/api/crm/route.ts` (actions `mode_set`, `projects_list`, `project_save`, `units_list`, `unit_save`, `units_import`, `unit_hold`, `unit_release`, `unit_status` ...)
- Screens: `public/CRM/properties.html`, `visits.html`, `partners.html`, `reports.html` (shared styles in `re.css`), and mode-aware parts of `public/CRM/index.html`
- Logic (pure, tested): `lib/crm/realestate.ts`, `property.ts`, `notes.ts`, `media.ts`, `visits.ts`, `commission.ts`, `publicPage.ts`, `reports.ts`
- Public pages: `app/property/[pub]`, `app/unit/[pub]`, `app/catalogue/[pub]` (shared helpers in `lib/crm/publicRoute.ts`, rendering in `lib/crm/publicPage.ts`); enquiry form posts to the `enquiry` action in `app/api/crm/route.ts`
- Tests: `npm test` (runs against an in-memory database; no MongoDB needed)

## Not built yet
Cost sheets and quotations, GST/TDS on payouts, per-company WhatsApp API, Razorpay subscriptions.
