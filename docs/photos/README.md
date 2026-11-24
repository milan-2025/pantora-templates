# Wedding photo galleries (/photos)

Couples make a gallery, add their wedding photos and videos, and share one link (`/p/<link>`) or a QR code with guests.

| Page | What it is |
|---|---|
| `/photos` | Landing page, plans, "Create my gallery", sign in with email code |
| `/p/<link>` | The gallery guests see: cover, albums, lightbox, download, "Add your photos" (Premium/Royal) |
| `/p/<link>/manage` | The couple's dashboard: upload, albums, approve guest photos, share/QR, PIN, plan & payment |
| `/api/photos/…` | Every API call (one file: `app/api/photos/[...path]/route.ts`) |

Admin: **Wedding photos** group → *Photo galleries*, *Photos & videos*, *Photo gallery plans & prices*.
Coupon codes: add a product deal of type *Wedding photo gallery plan* (or leave the plan empty for every plan and renewals).

## How the files move (and why it's cheap)

- The browser shrinks each photo before uploading: a display copy (long edge 2560 px) and a thumbnail (640 px). Royal also keeps the full-size original. Nothing heavy goes through the website server.
- Files go **straight from the browser to the storage bucket** with signed links that are valid for one hour and only accept the exact file size we approved.
- Guests load photos **straight from the bucket's public address**. File names contain a random part, so nobody can guess them.
- Videos (Premium/Royal) are stored in the same bucket and play in the browser's own player. Optional: Bunny Stream (see below).

## Plans (defaults, editable in admin)

| Plan | Price | Photos | Video | Online for | Guest uploads | Originals |
|---|---|---|---|---|---|---|
| Free | ₹0 | 300 | none | 30 days | no | no |
| Basic | ₹1,299 | 3,000 | none | 1 year | no | no |
| Premium | ₹2,999 | 8,000 | 5 GB | 2 years | yes | no |
| Royal | ₹5,999 | 20,000 | 25 GB | 5 years | yes | yes |

Renewal: ₹399 per extra year. Upgrades pay the difference. Paying never shortens how long a gallery stays online.

## Set up storage: Cloudflare R2 (recommended)

R2 has a free tier (10 GB stored, 1M uploads and 10M reads a month) and **never charges for downloads**, which matters because guests view photos many times.

1. Cloudflare dashboard → **R2** → *Create bucket*, e.g. `pandora-photos` (location: Asia-Pacific). Cloudflare asks for a card to turn R2 on, even on the free tier.
2. Bucket → **Settings → Public access → Custom domain** → add `photos.pandoratemplates.com` (Cloudflare creates the DNS record if the domain is on Cloudflare; otherwise use the bucket's `r2.dev` address for now).
3. Bucket → **Settings → CORS policy** → paste:
   ```json
   [
     {
       "AllowedOrigins": ["https://pandoratemplates.com", "https://www.pandoratemplates.com", "http://localhost:3000"],
       "AllowedMethods": ["PUT", "GET", "HEAD"],
       "AllowedHeaders": ["content-type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
4. R2 → **Manage API tokens** → *Create API token* → permission **Object Read & Write**, only this bucket. Copy the Access Key ID, Secret and the S3 endpoint.
5. Add to the site's environment variables (Hostinger → your Node app → Environment variables), then redeploy:
   ```
   PHOTOS_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   PHOTOS_S3_REGION=auto
   PHOTOS_S3_BUCKET=pandora-photos
   PHOTOS_S3_KEY_ID=...
   PHOTOS_S3_SECRET=...
   PHOTOS_PUBLIC_URL=https://photos.pandoratemplates.com
   ```

Other S3-compatible storage works with the same variables (only the endpoint/region change): Backblaze B2 (about half R2's storage price, free downloads up to 3× what you store), Hetzner Object Storage, Wasabi, AWS S3.

Without these variables the site stores files in `./.photos-local` (local development only; refused in production).

## Daily job (needed)

Once a day, call:
```
GET https://pandoratemplates.com/api/photos/cron
Authorization: Bearer <CRON_SECRET>
```
It emails couples before their gallery expires, hides expired galleries, deletes files of galleries that stayed expired (7 days for Free, 60 days for paid), and clears uploads that never finished. Use the same `CRON_SECRET` as the planner/workout jobs (e.g. cron-job.org, free).

## Optional: Bunny Stream for smoother video

Off by default and costs nothing while off. Videos then play straight from R2 (fine for highlight films; very large 4K files may buffer on slow phones).

To turn it on: bunny.net → Stream → create a Video Library → API → copy the Library ID and API key, then set
```
BUNNY_STREAM_LIBRARY_ID=...
BUNNY_STREAM_API_KEY=...
```
New Premium/Royal videos are then also sent to Bunny (Bunny fetches them from R2), and guests get Bunny's adaptive player once encoding finishes. Bunny bills for storage and streaming, with a $1 monthly minimum once the account is active.

## Not in version 1

Selfie face search ("find my photos"), download-whole-album as ZIP, photographer accounts (many galleries per login), custom domains per gallery.
