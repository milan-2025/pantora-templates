# LeadFlow CRM (multi-company) at /CRM

- Product page: `/crm`  (static: `public/crm-software.html`)
- Sign up (free 14-day trial): `/CRM/signup.html`   Log in: `/CRM/login.html`   App: `/CRM`
- Platform admin (for the owner): `/CRM/admin.html`
- Server code: `app/api/crm/route.ts`. Data: MongoDB collections `crm_workspaces`, `crm_users`, `crm_leads`, `crm_settings`.
  The shop, checkout, payments and Payload admin are untouched.

## How companies are separated
Every user, lead and setting belongs to one workspace (company). Every database query is scoped to the logged-in user's workspace,
so one company can never read or change another's data (covered by automated tests).
The original single-company data is moved automatically, on first start, into an "internal" workspace (unlimited plan).

## Plans (limits set in `PLANS` in route.ts)
| plan | users | leads |
|---|---|---|
| trial (14 days, then read-only) | 5 | 500 |
| starter | 3 | 2,000 |
| growth | 10 | 10,000 |
| internal (you) | unlimited | unlimited |

When a trial or "paid until" date passes, the company can still log in and read its data but changes are blocked (data is never deleted).

## Environment variables
- `CRM_SUPERADMINS`: your email(s), comma separated. Lets you open `/CRM/admin.html` to see every company, change its plan, set "paid until",
  extend a trial, or suspend it. **Set this, then redeploy.**
- `CRM_USERS`: only used when the CRM has no users at all (first install).
- `CRM_COMPANY`: name of your own internal workspace.
- Optional: `META_*` (live Meta leads, internal workspace only for now) and `SHEET_TOKEN` (old shared token, kept for your own sheet).
  Customers each get their own Google Sheets token inside the app (Menu > Google Sheets sync).

## Taking payment for now
Billing is manual in this stage: when a customer pays you (UPI/bank/Razorpay link), open `/CRM/admin.html`, set their plan and "paid until" date.

## NOT built yet (needed before a public launch)
- Terms of Service, Privacy Policy and consent wording (have these written/reviewed; the app stores customers' leads' personal data).
- Email verification and "forgot password" emails (until then a company admin resets staff passwords under Manage users).
- Automatic subscriptions and GST invoices (Razorpay), per-customer Meta Lead Ads connection, per-customer WhatsApp, white-label branding.
