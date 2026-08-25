import React from "react";
import { cn } from "@/lib/utils";

interface SpectraLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
  iconOnly?: boolean;
}

export function SpectraLogo({
  className,
  size = "md",
  showTagline = true,
  iconOnly = false,
}: SpectraLogoProps) {
  const iconSizes = {
    sm: "size-6",
    md: "size-8",
    lg: "size-10",
  };

  const titleSizes = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
  };

  const subtitleSizes = {
    sm: "text-[9px]",
    md: "text-[10px]",
    lg: "text-[11px]",
  };

  return (
    <div className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      {/* Spectra Pulse / Fiber Wave Icon */}
      <div className="relative flex items-center justify-center">
        <div className={cn("relative rounded-xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-600 p-2 shadow-lg shadow-cyan-500/25 ring-1 ring-white/20 transition-all duration-300 hover:shadow-cyan-500/40 hover:scale-105", iconSizes[size])}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-full h-full text-white"
          >
            {/* Speed pulse & fiber optics paths */}
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" className="fill-cyan-300/30 text-white" />
          </svg>
          {/* Subtle glowing ring */}
          <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 opacity-40 blur-sm -z-10 group-hover:opacity-75 transition duration-300" />
        </div>
      </div>

      {!iconOnly && (
        <div className="flex flex-col">
          <span className={cn("font-black tracking-wider uppercase bg-gradient-to-r from-foreground via-foreground to-cyan-600 dark:to-cyan-400 bg-clip-text text-transparent leading-none", titleSizes[size])}>
            SPECTRA
          </span>
          {showTagline && (
            <span className={cn("font-semibold tracking-widest text-cyan-600 dark:text-cyan-400 uppercase opacity-90 mt-0.5 leading-none", subtitleSizes[size])}>
              Fiber Broadband
            </span>
          )}
        </div>
      )}
    </div>
  );
}
