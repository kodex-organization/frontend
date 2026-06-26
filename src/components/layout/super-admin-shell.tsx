import Link from "next/link";

const navItems = [
  { href: "/tenants", label: "Tenants" },
  { href: "/audit", label: "Audit Log" },
];

export function SuperAdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r border-slate-200 bg-slate-900 p-4 text-white">
        <p className="mb-6 text-sm font-semibold">CueCloud Admin</p>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm hover:bg-slate-800"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
