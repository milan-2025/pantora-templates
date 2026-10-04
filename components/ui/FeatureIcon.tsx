import { BellRing, Calculator, CalendarDays, FileSpreadsheet, Gift, Heart, RefreshCw, Smartphone, Users, Wallet } from "lucide-react";

const icons = { Calculator, Users, BellRing, FileSpreadsheet, Smartphone, RefreshCw, Heart, CalendarDays, Wallet, Gift };

export function FeatureIcon({ name, className }: { name?: string | null; className?: string }) {
  const Icon = icons[(name ?? "Gift") as keyof typeof icons] ?? Gift;
  return <Icon className={className} strokeWidth={2} />;
}

export const ICON_TINTS = [
  "bg-sand text-marigold-deep",
  "bg-blush text-coral",
  "bg-lavender text-plum",
  "bg-mint text-teal",
];
