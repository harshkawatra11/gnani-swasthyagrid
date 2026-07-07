"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "./nav-items";

const groups = ["Command", "Operations", "District", "Public"] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-hairline bg-paper-dim/40 h-screen sticky top-0">
      <div className="px-5 py-6 border-b border-hairline">
        <p className="text-[10px] tracking-[0.18em] uppercase text-ink-soft mb-1">
          District Ops Center
        </p>
        <p className="font-serif-display italic text-xl text-ink">SwasthyaGrid AI</p>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {groups.map((group) => (
          <div key={group} className="mb-5">
            <p className="px-5 text-[10px] tracking-[0.16em] uppercase text-ink-soft/70 mb-1.5">
              {group}
            </p>
            {navItems
              .filter((item) => item.group === group)
              .map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 px-5 py-2 text-sm transition-colors border-l-2 ${
                      active
                        ? "border-accent-clay bg-parchment/60 text-ink font-medium"
                        : "border-transparent text-ink-soft hover:text-ink hover:bg-parchment/30"
                    }`}
                  >
                    <Icon size={16} strokeWidth={1.75} />
                    {item.label}
                  </Link>
                );
              })}
          </div>
        ))}
      </nav>

    </aside>
  );
}
