export function Updated() {
  return (
    <p className="text-sm text-charcoal/60">
      Last updated: October 2026
      {process.env.NODE_ENV === "development" && (
        <span className="ml-2 rounded bg-sand px-1.5 font-mono text-[11px]">DEV: template text. Have the client review it</span>
      )}
    </p>
  );
}
