import {
  BedDouble,
  BellRing,
  BookOpen,
  Briefcase,
  Calculator,
  CalendarDays,
  CalendarHeart,
  Dumbbell,
  FileSpreadsheet,
  Gift,
  Heart,
  House,
  Image as ImageIcon,
  Mail,
  RefreshCw,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";

const icons = {
  Calculator,
  Users,
  BellRing,
  FileSpreadsheet,
  Smartphone,
  RefreshCw,
  Heart,
  CalendarDays,
  Wallet,
  Gift,
  CalendarHeart,
  Mail,
  House,
  Dumbbell,
  ShoppingBag,
  Sparkles,
  Image: ImageIcon,
  BookOpen,
  Briefcase,
  BedDouble,
};

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
