import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ShieldCheck, User } from "lucide-react";
import { FetchDataSteps } from "@/components/tutorial/fetch-data-steps";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

async function UserDetails() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  return JSON.stringify(data.claims, null, 2);
}

export default function ProtectedPage() {
  return (
    <div className="flex-1 w-full flex flex-col gap-8">
      <div className="w-full">
        <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 px-6 text-sm font-medium text-cyan-600 dark:text-cyan-400 flex items-center gap-3 shadow-sm backdrop-blur-md">
          <ShieldCheck className="size-5 shrink-0 text-cyan-500" />
          <span>
            This is an authenticated Spectra session page. Only logged-in subscribers can view this page.
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-border/80 bg-card/85 p-6 backdrop-blur-xl shadow-xl spectra-glow">
        <div className="flex items-center gap-2 mb-4">
          <User className="size-5 text-cyan-500" />
          <h2 className="font-bold text-xl tracking-tight text-foreground">
            Subscriber Profile Details
          </h2>
        </div>
        <pre className="text-xs font-mono p-4 rounded-xl border border-border/60 bg-muted/50 max-h-48 overflow-auto text-muted-foreground">
          <Suspense fallback={<span>Loading session claims...</span>}>
            <UserDetails />
          </Suspense>
        </pre>
      </div>

      <div className="rounded-2xl border border-border/80 bg-card/85 p-6 backdrop-blur-xl shadow-xl spectra-glow">
        <h2 className="font-bold text-xl tracking-tight text-foreground mb-4">
          Developer & Integration Steps
        </h2>
        <FetchDataSteps />
      </div>
    </div>
  );
}
