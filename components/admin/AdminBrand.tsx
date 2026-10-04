import { LogoMark } from "@/components/Logo";

// Tailwind isn't loaded in the admin, so sizes come from app/(payload)/custom.scss.

/** Pandora Templates branding inside the admin (login screen). */
export function AdminLogo() {
  return (
    <div className="pt-admin-logo">
      <span className="pt-admin-mark pt-admin-mark--lg">
        <LogoMark box="currentColor" className="" />
      </span>
      <span className="pt-admin-wordmark">
        <span>Pandora</span>
        <small>TEMPLATES</small>
      </span>
    </div>
  );
}

/** Small icon in the admin's top bar. */
export function AdminIcon() {
  return (
    <span className="pt-admin-mark">
      <LogoMark box="currentColor" className="" />
    </span>
  );
}
