import { DeployButton } from "@/components/deploy-button";
import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";
import { Suspense } from "react";
import { SpectraLogo } from "@/components/spectra-logo";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex flex-col items-center bg-background text-foreground">
      <div className="flex-1 w-full flex flex-col items-center">
        <nav className="w-full flex justify-center border-b border-border/60 bg-card/60 backdrop-blur-md sticky top-0 z-50">
          <div className="w-full max-w-7xl flex justify-between items-center p-3 px-4 sm:px-6 text-sm">
            <div className="flex gap-4 items-center font-semibold">
              <Link href={"/"} className="transition-transform hover:scale-105">
                <SpectraLogo size="sm" />
              </Link>
              <div className="hidden md:flex items-center gap-2">
                <DeployButton />
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!hasEnvVars ? (
                <EnvVarWarning />
              ) : (
                <Suspense>
                  <AuthButton />
                </Suspense>
              )}
              <ThemeSwitcher />
            </div>
          </div>
        </nav>

        <div className="flex-1 flex flex-col gap-8 w-full max-w-7xl p-4 sm:p-6 lg:p-8">
          {children}
        </div>

        <footer className="w-full flex flex-col sm:flex-row items-center justify-between border-t border-border/60 max-w-7xl px-6 py-8 text-xs text-muted-foreground gap-4">
          <div className="flex items-center gap-2">
            <SpectraLogo size="sm" showTagline={false} />
            <span>&copy; 2026 Spectra Fiber Broadband. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://supabase.com/?utm_source=create-next-app&utm_medium=template&utm_term=nextjs"
              target="_blank"
              className="font-medium hover:text-cyan-500 transition-colors"
              rel="noreferrer"
            >
              Powered by Supabase
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}
