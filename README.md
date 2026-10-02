# Pandora Templates: Wedding Planner landing page

A sales landing page for the ₹2,100 wedding-planning spreadsheet sold by [@pandoratemplates](https://www.instagram.com/pandoratemplates). It is built to convert Instagram ad traffic.

**Brand:** Pandora Templates brand guidelines v1. Colour tokens are in `app/globals.css`; the logo is in `components/Logo.tsx`; fonts are DM Serif Display (headings) and Poppins (body).

**Stack:** Next.js 15 (App Router), Tailwind CSS v4, Motion (Framer Motion), Lenis, Resend and zod.

## Run it

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Where things live

| What | File |
|---|---|
| **All copy** (price, FAQs, features, testimonials, links) | `lib/content.ts` |
| Landing page sections | `components/sections/*` |
| Animated spreadsheet mockup | `components/SpreadsheetMockup.tsx` |
| Checkout UI | `app/checkout/*` |
| Payment gateway abstraction | `lib/payments.ts` |
| API routes | `app/api/payment/create-order`, `app/api/payment/verify` |
| Delivery email | `lib/email.ts` |
| Thank-you / download page | `app/success/*` |
| Legal pages (needed by payment gateways) | `app/(legal)/*` |
| AI video prompts | `VIDEO_PROMPTS.md` → files go in `public/videos/` |

## Before launch checklist

- [ ] Put the real spreadsheet at `public/downloads/wedding-planner.xlsx`
- [ ] Set the Google Sheets "make a copy" link in `lib/content.ts` (`product.googleSheetsCopy`)
- [ ] Replace the **placeholder testimonials** in `lib/content.ts` with real reviews
- [ ] Confirm the `compareAtPrice` (the struck-through price) is genuine, or set it to `null`
- [ ] Have the client review the legal pages, the refund policy and the FAQ answers
- [ ] Set `site.supportEmail`
- [ ] Generate the AI videos (`VIDEO_PROMPTS.md`)
- [ ] Set `RESEND_API_KEY`, verify a sending domain and set `EMAIL_FROM`
- [ ] Set `NEXT_PUBLIC_META_PIXEL_ID` for ad tracking
- [ ] Connect a real payment gateway (see below)

## Connecting the payment gateway

Payments currently use a **mock provider**: the full UI flow works and no money is charged. Mock mode is **refused in production** unless `ALLOW_MOCK_PAYMENTS=true`, which is useful for a client preview deploy.

To connect Razorpay, Cashfree or another gateway:

1. Implement a provider in `lib/payments.ts` (a Razorpay skeleton is included there as comments) and set `PAYMENT_PROVIDER`.
2. In `app/checkout/CheckoutForm.tsx`, at `// GATEWAY CHECKOUT GOES HERE`, open the gateway's checkout widget with `order.clientData` and pass its response as `payload` to the verify call.
3. **Secure the downloads.** Right now the file sits in `/public`, so anyone with the link can download it. Once real payments are on, store orders in a database, serve the file from a route that checks the order is paid (or use signed, expiring URLs), and move email delivery to the gateway's webhook.
