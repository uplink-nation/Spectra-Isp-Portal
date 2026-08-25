"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SpectraLogo } from "@/components/spectra-logo";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { LogoutButton } from "@/components/logout-button";
import {
  Activity,
  Receipt,
  HelpCircle,
  Menu,
  X,
  User,
  Shield,
} from "lucide-react";
import { useState } from "react";

interface PortalNavProps {
  customerName: string;
  pppoeUsername: string;
  isAdmin?: boolean;
  children?: React.ReactNode;
}

export function PortalNav({
  customerName,
  pppoeUsername,
  isAdmin = false,
  children,
}: PortalNavProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    {
      href: "/",
      label: "Data Usage",
      icon: Activity,
      exact: true,
    },
    {
      href: "/invoices",
      label: "Invoices & Billing",
      icon: Receipt,
      exact: false,
    },
    {
      href: "/support",
      label: "Diagnostics & Support",
      icon: HelpCircle,
      exact: false,
    },
  ];

  const isLinkActive = (href: string, exact: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-card/85 backdrop-blur-xl transition-all shadow-sm">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-2 sm:gap-4">
          {/* Brand Logo & Desktop Nav Links */}
          <div className="flex items-center gap-4 lg:gap-6 min-w-0">
            <Link
              href="/"
              className="flex items-center gap-2 transition-transform hover:scale-[1.02] shrink-0"
            >
              <SpectraLogo size="sm" />
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1.5 rounded-xl bg-muted/40 p-1 border border-border/60">
              {navLinks.map((item) => {
                const active = isLinkActive(item.href, item.exact);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      active
                        ? "bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/20 font-bold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }`}
                  >
                    <Icon className={`size-3.5 ${active ? "text-slate-950" : "text-cyan-500"}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Subscriber PPPoE Pill (Desktop only) */}
            <div className="hidden xl:flex items-center gap-2 rounded-xl border border-border/80 bg-background/60 px-3 py-1.5 text-xs shadow-sm">
              <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono text-cyan-600 dark:text-cyan-400 font-semibold truncate max-w-[150px]">
                {pppoeUsername}
              </span>
            </div>

            {/* Admin Operator Quick Link (Desktop only) */}
            {isAdmin && (
              <Link
                href="/admin"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1.5 text-xs font-bold text-indigo-400 transition-all shadow-sm"
                title="Open Central Admin & NOC Command Center"
              >
                <Shield className="size-3.5" />
                <span>NOC Admin</span>
              </Link>
            )}

            {/* Desktop Action Buttons */}
            <div className="hidden sm:flex items-center gap-2">
              {children}
            </div>

            {/* Theme switcher always visible */}
            <ThemeSwitcher />

            {/* Desktop Logout Button (Icon only on compact screens, full on large) */}
            <div className="hidden md:block">
              <LogoutButton iconOnly={false} />
            </div>

            {/* Mobile Menu Trigger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex md:hidden p-2 rounded-xl border border-border/80 bg-background/60 hover:bg-muted text-foreground transition-all shrink-0"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? (
                <X className="size-5 text-foreground" />
              ) : (
                <Menu className="size-5 text-foreground" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border/60 py-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
            {/* Subscriber identity card in mobile menu */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 border border-border/60 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-7 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500 shrink-0">
                  <User className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-foreground truncate">{customerName}</p>
                  <p className="font-mono text-cyan-600 dark:text-cyan-400 text-[11px] truncate">
                    {pppoeUsername}
                  </p>
                </div>
              </div>
            </div>

            {/* Mobile Extra Action (like Export PDF on mobile) */}
            {children && (
              <div className="pt-1 sm:hidden">
                {children}
              </div>
            )}

            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between p-3 text-xs font-bold rounded-2xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-400"
              >
                <div className="flex items-center gap-2.5">
                  <Shield className="size-4" />
                  <span>Central NOC Admin Dashboard</span>
                </div>
                <span className="text-xs font-mono">&rarr;</span>
              </Link>
            )}

            {/* Mobile Nav Links */}
            <div className="grid grid-cols-1 gap-1.5">
              {navLinks.map((item) => {
                const active = isLinkActive(item.href, item.exact);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-2.5 text-xs font-bold rounded-xl transition-all ${
                      active
                        ? "bg-cyan-500 text-slate-950 shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Icon className={`size-4 ${active ? "text-slate-950" : "text-cyan-500"}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Mobile Logout Button (Prominent in menu) */}
            <div className="pt-2 border-t border-border/60">
              <LogoutButton fullWidth showText={true} />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
