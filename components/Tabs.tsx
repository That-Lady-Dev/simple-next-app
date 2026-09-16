"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Today", icon: "🍽️" },
  { href: "/history", label: "History", icon: "📅" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export function Tabs() {
  const path = usePathname();
  return (
    <nav className="tabs">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={path === t.href ? "active" : ""}>
          <span className="icon">{t.icon}</span>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
