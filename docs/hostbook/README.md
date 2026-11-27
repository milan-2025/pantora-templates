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

## Check-in form
- **Required fields**: the host picks them in the app (Settings → Check-in form): phone, email, address, city, nationality, gender, age, ID type & number, ID photo front/back; for the main guest or every adult. Default: phone, ID number, ID front photo. Name is always required. Stored on the host account (`checkinRequired`, `checkinAllGuests`).
- **Format checks** (`lib/hostbook/core.ts` → `checkId`, `checkPhone`, `checkEmail`, `checkGuest`), the same on the guest form, the host's guest editor and the server:
  - Aadhaar: 12 digits, can't start with 0/1, Verhoeff check digit; saved as `1234 5678 9012`.
  - PAN: `ABCDE1234F`. Voter ID (EPIC): `ABC1234567`. Driving licence: state code + 2 digits + 9–14 characters.
  - Passport: Indian `A1234567`, foreign 6–9 letters/digits.
  - Phone: Indian mobile (10 digits starting 6–9, +91/0 allowed), or + country code.
  - Email: basic format check.
- **Fixing details**: guests can change their details until the host approves them. The host can tap "Ask guest to fix" on a booking, pick the items and add a note. The booking goes to `checkinStatus: "changes"`, and the guest's link opens again pre-filled (ID numbers masked; a blank ID keeps the saved one) with the items marked. A new photo of a side replaces the old one.
- A returning guest matched by phone is updated (not duplicated), and doesn't need to resend an ID the host already has.

## Notifications (instead of most emails)
- Stored in `hb_items` as `kind: "notice"` (to the owner, or to staff with a given permission), shown under the bell and on the Today screen, cleared after 60 days. Read state is per person.
- **Phone notifications**: web push with no payload. Keys are in HostBook settings (hidden fields, made automatically). Subscriptions are in the MongoDB collection `hb_push`. The app's worker (`/hostbook-sw.js`) asks `/api/hostbook/push/latest` what to show. Free: no SMS or email cost.
- What makes a notification: guest details sent or updated, new or cancelled synced bookings, the 7 AM "today" summary (check-ins and check-outs; tasks due and low stock), plan ending, payment done.
- **Emails still sent**: sign-in codes, password changes, staff invitations, payment confirmations, plan-ending reminders, and the morning summary only if the owner turns it on (off by default).

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
