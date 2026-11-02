"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const desktopNavigation = [
  { label: "Dashboard", href: "/" },
  { label: "Tasks", href: "/tasks" },
  { label: "People", href: "/people" },
  { label: "Teams", href: "/teams" },
  { label: "Settings", href: "/settings" },
];

const mobileNavigation = [
  { label: "Today", href: "/" },
  { label: "Tasks", href: "/tasks" },
  { label: "People", href: "/people" },
  { label: "More", href: "/settings" },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

function NavigationLink({
  href,
  label,
  compact = false,
}: {
  href: string;
  label: string;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const active = isActive(pathname, href);

  return (
    <Link
      className={`navigation-link${active ? " active" : ""}${compact ? " compact" : ""}`}
      href={href}
      aria-current={active ? "page" : undefined}
    >
      <span className="navigation-mark" aria-hidden="true">
        {label.slice(0, 1)}
      </span>
      <span>{label}</span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            K
          </span>
          <span>Kazi Merge</span>
        </Link>
        <nav className="desktop-navigation">
          {desktopNavigation.map((item) => (
            <NavigationLink key={item.href} {...item} />
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="avatar" aria-hidden="true">
            AN
          </span>
          <span>
            <strong>Amina Nakato</strong>
            <small>Owner</small>
          </span>
        </div>
      </aside>

      <main className="app-content">
        <header className="mobile-header">
          <Link className="brand" href="/">
            <span className="brand-mark" aria-hidden="true">
              K
            </span>
            <span>Kazi Merge</span>
          </Link>
          <button
            className="profile-button"
            type="button"
            aria-label="Open profile menu"
          >
            AN
          </button>
        </header>
        {children}
      </main>

      <nav className="mobile-navigation" aria-label="Mobile navigation">
        {mobileNavigation.map((item) => (
          <NavigationLink key={item.href} {...item} compact />
        ))}
      </nav>

      <Link className="new-task-button" href="/tasks/new">
        <span aria-hidden="true">+</span>
        <span>New task</span>
      </Link>
    </div>
  );
}
