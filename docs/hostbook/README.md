# Pandora HostBook (Airbnb / homestay host tool)

Guest register with IDs, bookings and calendar, online guest check-in, regular tasks, income & expenses, reports, police register and Form C, for hosts with one or many listings.

## Addresses
| What | URL |
|---|---|
| Landing page & plans | `/hostbook` |
| The app (sign up, sign in, everything) | `/hostbook/app` (`?signup=1` opens "Create account") |
| Guest check-in link (one per booking) | `/hostbook/c/<code>` |
| From the Pandora Stays host portal | "HostBook" button → `/hostbook/app?via=stays` (signs in with the Stays session, Stays plan free) |
| API | `/api/hostbook/<path>` (one route file) |

## Admin (`/admin` → HostBook)
- **HostBook plans**: add, rename, hide or reorder plans. Each has a price (₹ a year), listings, staff, how long ID photos are kept, and a tick list of features. Changes apply straight away; removing a feature only locks it (data stays). The four starting plans are created the first time HostBook runs.
- **Host accounts**: one per host. Give a plan by hand by picking it and an end date. Staff and extra listings are here too.
- **HostBook settings**: price of an extra listing, which plan Stays hosts get free (`starter`), renewal reminder days, WhatsApp number, offer line.
- **Coupon codes**: product deal type "HostBook plan" (one plan or all).

## Where data lives
- Plans, accounts and sign-in codes: Payload collections `hostbook-plans`, `hostbook-accounts`, `hostbook-logins`.
- Everything a host enters (listings, bookings, guests, expenses, tasks…): MongoDB collection `hb_items` (one document per record, `acct` = account id). Deleted records leave a small `deleted: true` marker so other devices drop them on sync.
- **Guest ID photos**: existing Cloudinary account, folder `hostbook-ids/<hash>/`, uploaded as `type: authenticated` (no public URL). They're opened only through `private_download_url` links that expire after 10 minutes, and deleted by the daily job after the plan's keep time. Receipts and damage photos go to `hostbook-files/<hash>/`. No new env vars.

## Scheduled job (Hostinger cron, to add)
`/api/hostbook/cron` with `Authorization: Bearer <CRON_SECRET>`. Suggested: every 3 hours (`0 */3 * * *`).
- Every run: Airbnb / Booking.com calendar sync for every listing with links.
- First run each day (India date): delete expired ID photos, add repeating expenses, make cleaning checklists for today's check-outs, send the morning email (check-ins, check-outs, tasks due, low stock) to owners and staff, plan-ending reminders.
- `?daily=1` forces the daily part.

## Payments
Razorpay like the other apps: `checkout` → Razorpay → `checkout/verify`; the webhook also confirms HostBook orders. Upgrades pay the difference and keep the end date; renewals add a year; moving to a cheaper plan waits until the current one ends.

## Tests
`tests/hostbook.test.ts` (reports, iCal, plans, coupons) and `tests/hostbook-api.test.ts` (the real API with an in-memory database: sign-up, limits, check-in, staff permissions, payment, admin plan changes, daily job).
