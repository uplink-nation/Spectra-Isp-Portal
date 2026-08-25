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
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { SpectraLogo } from "@/components/spectra-logo";
import {
  Lock,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertTriangle,
  KeyRound,
} from "lucide-react";

export function UpdatePasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function verifyAuthSession() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // Check if user is authenticated via recovery link or active session
      if (!session) {
        // Also listen for auth state changes if hash token is being parsed
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event, newSession) => {
          if (newSession || event === "PASSWORD_RECOVERY") {
            setHasValidSession(true);
            setCheckingSession(false);
          }
        });

        // Small timeout to allow client hash parser to finish
        setTimeout(() => {
          setCheckingSession(false);
        }, 1200);

        return () => subscription.unsubscribe();
      } else {
        setHasValidSession(true);
        setCheckingSession(false);
      }
    }

    verifyAuthSession();
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please verify and try again.");
      return;
    }

    const supabase = createClient();
    setIsLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) throw updateError;

      setIsSuccess(true);

      // Auto redirect to dashboard after 3 seconds
      setTimeout(() => {
        router.push("/");
      }, 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update password. Your reset link may have expired.");
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

        {checkingSession ? (
          <CardContent className="px-6 py-16 text-center space-y-3">
            <Loader2 className="size-8 animate-spin mx-auto text-cyan-500" />
            <p className="text-sm font-semibold text-foreground">
              Verifying security session...
            </p>
            <p className="text-xs text-muted-foreground">
              Checking your password reset authorization token
            </p>
          </CardContent>
        ) : isSuccess ? (
          <>
            <CardHeader className="text-center pt-8 pb-3">
              <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 animate-in zoom-in-50 duration-300">
                <CheckCircle2 className="size-7" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
                Password Updated!
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                Your Spectra account credentials have been changed successfully.
              </CardDescription>
            </CardHeader>

            <CardContent className="px-6 pb-8 space-y-4">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                You will be automatically redirected to your dashboard in 3 seconds...
              </div>

              <Button
                asChild
                className="w-full h-11 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-lg shadow-cyan-500/25"
              >
                <Link href="/" className="flex items-center justify-center gap-2">
                  <span>Go to Usage Dashboard</span>
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardContent>
          </>
        ) : !hasValidSession ? (
          <>
            <CardHeader className="text-center pt-8 pb-3">
              <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500">
                <AlertTriangle className="size-7" />
              </div>
              <CardTitle className="text-xl font-bold tracking-tight text-foreground">
                Reset Link Expired
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                No active password recovery session was detected. Your reset link may have expired or already been used.
              </CardDescription>
            </CardHeader>

            <CardContent className="px-6 pb-8 space-y-4">
              <Button asChild className="w-full h-11 rounded-xl font-bold text-sm bg-cyan-500 hover:bg-cyan-400 text-slate-950">
                <Link href="/auth/forgot-password" className="flex items-center justify-center gap-2">
                  <span>Request New Reset Link</span>
                  <ArrowRight className="size-4" />
                </Link>
              </Button>

              <Button asChild variant="outline" className="w-full h-10 rounded-xl text-xs font-semibold">
                <Link href="/auth/login">
                  Back to Sign In
                </Link>
              </Button>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader className="text-center pt-8 pb-4">
              <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-500">
                <KeyRound className="size-6" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
                Choose New Password
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                Enter your new secured password for your Spectra fiber account
              </CardDescription>
            </CardHeader>

            <CardContent className="px-6 pb-8">
              <form onSubmit={handleUpdatePassword}>
                <div className="flex flex-col gap-4">
                  {/* New Password */}
                  <div className="grid gap-1.5">
                    <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      New Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        required
                        minLength={6}
                        className="pl-10 pr-10 h-11 rounded-xl border-border/70 bg-background/50 focus-visible:ring-cyan-500 text-sm font-mono"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="grid gap-1.5">
                    <Label htmlFor="confirm-password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Confirm New Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="••••••••"
                        required
                        minLength={6}
                        className="pl-10 pr-10 h-11 rounded-xl border-border/70 bg-background/50 focus-visible:ring-cyan-500 text-sm font-mono"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Password requirements indicators */}
                  <div className="space-y-1 text-[11px] pt-1">
                    <div className="flex items-center gap-1.5">
                      <div className={`size-1.5 rounded-full ${password.length >= 6 ? "bg-emerald-500" : "bg-muted-foreground/50"}`} />
                      <span className={password.length >= 6 ? "text-emerald-500 font-medium" : "text-muted-foreground"}>
                        At least 6 characters
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className={`size-1.5 rounded-full ${password && confirmPassword && password === confirmPassword ? "bg-emerald-500" : "bg-muted-foreground/50"}`} />
                      <span className={password && confirmPassword && password === confirmPassword ? "text-emerald-500 font-medium" : "text-muted-foreground"}>
                        Passwords match
                      </span>
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-500 font-medium text-center">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="mt-2 w-full h-11 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-lg shadow-cyan-500/25 transition-all duration-200"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Updating Password...
                      </>
                    ) : (
                      <>
                        Save & Sign In
                        <ShieldCheck className="ml-2 size-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
