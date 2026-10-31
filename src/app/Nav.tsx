"use client";
import { Radar } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Feed" },
  { href: "/keywords", label: "Keywords" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200/70 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-orange-500 to-rose-500 text-sm font-bold text-white"><Radar className="h-4 w-4" /></span>
          <span className="font-semibold tracking-tight">Reddit Radar</span>
        </div>
        <nav className="flex gap-1 rounded-full bg-zinc-100 p-1 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-full px-3 py-1 transition ${
                path === l.href
                  ? "bg-white font-medium shadow-sm"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
