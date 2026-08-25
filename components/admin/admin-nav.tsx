"use client";

import Link from "next/link";
import { SpectraLogo } from "@/components/spectra-logo";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { LogoutButton } from "@/components/logout-button";
import {
  Shield,
  ExternalLink,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminNavProps {
  operatorName: string;
  operatorUsername: string;
}

export function AdminNav({
  operatorName,
  operatorUsername,
}: AdminNavProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-indigo-500/20 bg-card/85 backdrop-blur-xl transition-all shadow-sm">
      {/* Top NOC Accent Bar */}
      <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Left: NOC Brand Logo */}
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="flex items-center gap-2 transition-transform hover:scale-[1.02]"
            >
              <SpectraLogo size="sm" showTagline={false} />
            </Link>

            <div className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-xs font-bold text-indigo-500">
              <Shield className="size-3.5" />
              <span>NOC OPERATIONS</span>
            </div>
          </div>

          {/* Right: Operator Identity, Switch to Subscriber Portal, Theme & Logout */}
          <div className="flex items-center gap-3">
            {/* Switch to Subscriber Portal */}
            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-xl border-border/80 text-xs font-semibold hover:border-cyan-500/40 hover:text-cyan-500 hidden sm:flex items-center gap-1.5"
            >
              <Link href="/">
                <span>Subscriber View</span>
                <ExternalLink className="size-3" />
              </Link>
            </Button>

            {/* Operator Pill */}
            <div className="flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/5 px-3 py-1.5 text-xs shadow-sm">
              <Lock className="size-3 text-indigo-400" />
              <div className="text-left">
                <span className="font-semibold text-foreground hidden md:inline">{operatorName}</span>
                <span className="font-mono text-[11px] text-indigo-400 font-bold ml-1.5">
                  ({operatorUsername})
                </span>
              </div>
            </div>

            <ThemeSwitcher />
            <LogoutButton />
          </div>
        </div>
      </div>
    </header>
  );
}
