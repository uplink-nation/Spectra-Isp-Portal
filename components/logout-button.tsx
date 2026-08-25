"use client";

import { createClient } from "@/lib/supabase/client";
import {
  Button,
  type ButtonProps,
} from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoutButtonProps extends Pick<ButtonProps, "className" | "variant" | "size"> {
  showText?: boolean;
  iconOnly?: boolean;
  fullWidth?: boolean;
}

export function LogoutButton({
  className,
  variant = "outline",
  size = "sm",
  showText = true,
  iconOnly = false,
  fullWidth = false,
}: LogoutButtonProps) {
  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  };

  return (
    <Button
      className={cn(
        "rounded-xl border border-border/70 bg-card/60 font-semibold text-xs backdrop-blur-md hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-500 transition-all duration-200 gap-1.5 shadow-sm",
        iconOnly && "size-9 p-0 justify-center rounded-xl",
        fullWidth && "w-full justify-center",
        className
      )}
      onClick={logout}
      size={iconOnly ? "icon" : size}
      variant={variant}
      title="Sign Out of Session"
      aria-label="Sign out"
    >
      <LogOut aria-hidden="true" className="size-3.5 shrink-0" />
      {showText && !iconOnly && <span className="hidden sm:inline">Logout</span>}
    </Button>
  );
}
