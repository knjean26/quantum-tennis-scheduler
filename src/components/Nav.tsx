"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Nav() {
  const path = usePathname();
  const links = [
    { href: "/courts", label: "Court Monitor" },
    { href: "/schedule", label: "Full Schedule" },
    { href: "/admin", label: "Admin" },
  ];
  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-5 h-14 overflow-x-auto scrollbar-none">
        <span className="font-bold text-emerald-700 text-lg shrink-0 whitespace-nowrap">🎾 Quantum Tennis</span>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`text-sm font-medium pb-0.5 border-b-2 transition-colors shrink-0 whitespace-nowrap ${
              path.startsWith(l.href)
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
