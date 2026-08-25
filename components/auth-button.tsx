import Link from "next/link";
import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";

export async function AuthButton() {
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  return user ? (
    <div className="flex items-center gap-3">
      <span className="text-xs font-medium text-muted-foreground hidden sm:inline-block">
        Signed in as <strong className="text-foreground">{user.email}</strong>
      </span>
      <LogoutButton />
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <Button asChild size="sm" variant="outline" className="rounded-lg text-xs font-medium border-border/60">
        <Link href="/auth/login">Sign in</Link>
      </Button>
      <Button asChild size="sm" className="rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-md shadow-cyan-500/20">
        <Link href="/auth/sign-up">Sign up</Link>
      </Button>
    </div>
  );
}
