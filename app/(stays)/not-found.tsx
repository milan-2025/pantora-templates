import Link from "next/link";

export default function StayNotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <p className="font-display text-6xl text-plum">404</p>
        <h1 className="mt-2 font-display text-3xl">This stay isn&apos;t available</h1>
        <p className="mx-auto mt-2 max-w-md text-muted">The link may have expired, or the property is no longer listed. Have a look at what&apos;s available now.</p>
        <Link href="/stays" className="s-btn s-btn-primary mt-6">Browse stays</Link>
      </div>
    </main>
  );
}
