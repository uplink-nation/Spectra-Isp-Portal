"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useState, useEffect } from "react";
import { SpectraLogo } from "@/components/spectra-logo";
import {
  Mail,
  ArrowRight,
  Loader2,
  CheckCircle2,
  RotateCcw,
  ShieldAlert,
  ArrowLeft,
} from "lucide-react";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleForgotPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email.trim()) return;

    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      // Directs the user to /auth/confirm which verifies the token/code and redirects to /auth/update-password
      const redirectUrl = `${window.location.origin}/auth/confirm?next=/auth/update-password`;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectUrl,
      });

      if (resetError) throw resetError;

      setSuccess(true);
      setResendCooldown(60); // 60 seconds cooldown
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred while sending reset instructions.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6 w-full max-w-md mx-auto", className)} {...props}>
      <div className="flex justify-center mb-2">
        <SpectraLogo size="lg" />
      </div>

      <Card className="rounded-2xl border-border/80 bg-card/85 backdrop-blur-xl shadow-2xl spectra-glow overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600" />

        {success ? (
          <>
            <CardHeader className="text-center pt-8 pb-3">
              <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 animate-in zoom-in-50 duration-300">
                <CheckCircle2 className="size-7" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
                Reset Link Dispatched
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                Password reset instructions have been emailed to:
              </CardDescription>
              <p className="mt-1 font-mono font-semibold text-sm text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 py-1.5 px-3 rounded-lg border border-cyan-500/20 inline-block mx-auto max-w-full truncate">
                {email}
              </p>
            </CardHeader>

            <CardContent className="px-6 pb-8 space-y-5">
              <div className="rounded-xl border border-border/70 bg-muted/40 p-4 text-xs text-muted-foreground space-y-2">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <Mail className="size-4 text-cyan-500" />
                  What happens next?
                </p>
                <p className="leading-relaxed">
                  1. Click the secure reset link inside the email to authenticate.
                </p>
                <p className="leading-relaxed">
                  2. You will be redirected to choose a new password.
                </p>
                <p className="text-[11px] text-muted-foreground/80 pt-1 border-t border-border/40">
                  Tip: If the email doesn&apos;t arrive within 2 minutes, check your Spam or Promotions folder.
                </p>
              </div>

              {error && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-500 font-medium text-center">
                  {error}
                </div>
              )}

              <div className="space-y-2.5">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isLoading || resendCooldown > 0}
                  onClick={() => handleForgotPassword()}
                  className="w-full h-11 rounded-xl text-xs font-semibold flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Resending Link...
                    </>
                  ) : resendCooldown > 0 ? (
                    <>
                      <RotateCcw className="size-3.5 opacity-50" />
                      Resend link in {resendCooldown}s
                    </>
                  ) : (
                    <>
                      <RotateCcw className="size-3.5" />
                      Resend Reset Email
                    </>
                  )}
                </Button>

                <Button asChild variant="ghost" className="w-full h-10 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground">
                  <Link href="/auth/login" className="flex items-center justify-center gap-1.5">
                    <ArrowLeft className="size-3.5" />
                    Back to Sign In
                  </Link>
                </Button>
              </div>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader className="text-center pt-8 pb-4">
              <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
                Forgot Password?
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                Enter your registered Spectra subscriber email to receive a password reset link
              </CardDescription>
            </CardHeader>

            <CardContent className="px-6 pb-8">
              <form onSubmit={handleForgotPassword}>
                <div className="flex flex-col gap-5">
                  <div className="grid gap-2">
                    <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Registered Email Address
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="subscriber@example.com"
                        required
                        className="pl-10 h-11 rounded-xl border-border/70 bg-background/50 focus-visible:ring-cyan-500 text-sm"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-500 font-medium flex items-center gap-2">
                      <ShieldAlert className="size-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-11 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-lg shadow-cyan-500/25 transition-all duration-200"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Generating Reset Link...
                      </>
                    ) : (
                      <>
                        Send Password Reset Link
                        <ArrowRight className="ml-2 size-4" />
                      </>
                    )}
                  </Button>
                </div>

                <div className="mt-6 text-center text-xs text-muted-foreground">
                  Remember your password?{" "}
                  <Link
                    href="/auth/login"
                    className="font-semibold text-cyan-600 dark:text-cyan-400 hover:underline underline-offset-4"
                  >
                    Sign In
                  </Link>
                </div>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
