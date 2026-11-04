/**
 * Cookie that remembers an affiliate's ?ref=CODE so the code is applied at checkout.
 * Shared by the browser and the server. The value is "CODE.<time it was set>", so the server can
 * enforce the admin's "Remember referral code for" setting even on cookies set earlier.
 */
export const REF_COOKIE = "pt_ref";

const UNIT_MS = { minutes: 60_000, hours: 3_600_000, days: 86_400_000 } as const;
const DEFAULT_MS = UNIT_MS.days;

type ReferralSettings = { referral?: { rememberFor?: number | null; rememberUnit?: string | null } | null } | null | undefined;

/** How long a referral code is remembered after the visitor clicks the link (from Site settings; default 1 day). */
export function referralMaxAgeMs(settings: ReferralSettings) {
  const r = settings?.referral;
  if (!r?.rememberFor || r.rememberFor <= 0) return DEFAULT_MS;
  const unit = UNIT_MS[(r.rememberUnit as keyof typeof UNIT_MS) ?? "days"] ?? UNIT_MS.days;
  return r.rememberFor * unit;
}

export const isValidRefCode = (v: string | null | undefined): v is string => !!v && /^[A-Za-z0-9_-]{3,30}$/.test(v);

export const refCookieValue = (code: string, now = Date.now()) => `${code.toUpperCase()}.${now}`;

/**
 * The remembered code, or null if there's none or it's older than the allowed time.
 * Cookies from before this format (no timestamp) count as expired.
 */
export function readRefCookie(value: string | null | undefined, maxAgeMs: number, now = Date.now()): string | null {
  if (!value) return null;
  const [rawCode, ts] = decodeURIComponent(value).split(".");
  const setAt = Number(ts);
  if (!isValidRefCode(rawCode) || !Number.isFinite(setAt) || setAt > now + 60_000) return null;
  return now - setAt <= maxAgeMs ? rawCode.toUpperCase() : null;
}
