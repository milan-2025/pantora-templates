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

## Rules built in
- Every project and unit belongs to one company; every query is scoped to it (see `tests/crm-api.test.ts`).
- Real estate endpoints return 403 when the company's mode is off.
- Trial/expired companies are read-only, including inventory and the mode switch.
- Plan unit limits (`UNIT_LIMITS` in `lib/crm/realestate.ts`): trial 200, starter 500, growth 5,000.

## Data (MongoDB)
`crm_workspaces.mode` (`"general"` or `"realestate"`), `crm_projects`, `crm_units` (unique per company + project + unit number).

## Code map
- Pure logic + tests: `lib/crm/realestate.ts`, `tests/realestate.test.ts`
- API: `app/api/crm/route.ts` (actions `mode_set`, `projects_list`, `project_save`, `units_list`, `unit_save`, `units_import`, `unit_hold`, `unit_release`, `unit_status` ...)
- Screens: `public/CRM/properties.html`, and mode-aware parts of `public/CRM/index.html`
- Tests: `npm test` (runs against an in-memory database; no MongoDB needed)

## Not built yet
Commissions and channel partners, GST/TDS invoicing, cost sheets, per-company WhatsApp, public property pages, Razorpay subscriptions.
