"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const ThemeSwitcher = () => {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="size-9 rounded-lg border border-border/50 bg-background/50 animate-pulse" />
    );
  }

  const ICON_SIZE = 16;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className="size-9 rounded-lg border-border/60 bg-card/60 backdrop-blur-md hover:bg-accent hover:border-cyan-500/40 hover:text-cyan-500 transition-all duration-200"
          aria-label="Switch Theme"
        >
          {theme === "light" ? (
            <Sun
              key="light"
              size={ICON_SIZE}
              className="text-amber-500 transition-all duration-200"
            />
          ) : theme === "dark" ? (
            <Moon
              key="dark"
              size={ICON_SIZE}
              className="text-cyan-400 transition-all duration-200"
            />
          ) : (
            <Laptop
              key="system"
              size={ICON_SIZE}
              className="text-muted-foreground transition-all duration-200"
            />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-36 rounded-xl border-border/60 bg-card/95 backdrop-blur-lg shadow-xl" align="end">
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(e) => setTheme(e)}
        >
          <DropdownMenuRadioItem className="flex items-center gap-2.5 rounded-md cursor-pointer focus:bg-cyan-500/10 focus:text-cyan-600 dark:focus:text-cyan-400" value="light">
            <Sun size={ICON_SIZE} className="text-amber-500" />{" "}
            <span className="font-medium text-xs">Light</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem className="flex items-center gap-2.5 rounded-md cursor-pointer focus:bg-cyan-500/10 focus:text-cyan-600 dark:focus:text-cyan-400" value="dark">
            <Moon size={ICON_SIZE} className="text-cyan-400" />{" "}
            <span className="font-medium text-xs">Dark</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem className="flex items-center gap-2.5 rounded-md cursor-pointer focus:bg-cyan-500/10 focus:text-cyan-600 dark:focus:text-cyan-400" value="system">
            <Laptop size={ICON_SIZE} className="text-muted-foreground" />{" "}
            <span className="font-medium text-xs">System</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export { ThemeSwitcher };
