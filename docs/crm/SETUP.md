# LeadFlow CRM at /CRM

The CRM is part of this site: screens in `public/CRM/`, server code in `app/api/crm/route.ts`,
and two rewrites in `next.config.ts` (`/CRM` and `/CRM/api.php`). Data is stored in the site's existing
MongoDB in three new collections (`crm_users`, `crm_leads`, `crm_settings`). The shop, checkout and Payload admin are untouched.

## Turn it on (after merging)
1. Add the environment variable **CRM_USERS** on the hosting (see `.env.example`), e.g.
   `Akhil|you@example.com|a-strong-password,Aman|aman@example.com|another-strong-one`
   The first entry becomes the admin. It is only used while the CRM has no users.
2. Redeploy, then open `https://pandoratemplates.com/CRM` and log in.
3. Afterwards manage users inside the CRM (Menu > Manage users & roles) and remove the passwords from CRM_USERS.

## Optional
- Live Meta leads: set META_VERIFY_TOKEN, META_APP_SECRET, META_PAGE_TOKEN; webhook URL `https://<site>/CRM/api.php?r=webhook`.
- Google Sheets sync: `docs/crm/GOOGLE_SHEETS_SETUP.md` (needs SHEET_TOKEN).

## Notes
- Sessions are signed with PAYLOAD_SECRET (already set for the site). Changing it logs everyone out of the CRM.
- Passwords are hashed with scrypt. Leads never appear on the public site or in Payload.
