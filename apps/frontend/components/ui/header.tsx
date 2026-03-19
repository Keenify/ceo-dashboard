"use client";

import { ThemeToggle } from "@/components/ui/theme-toggle";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

export function Header() {
  const pathname = usePathname();
  const showBack = pathname !== "/dashboard";

  return (
    <header className="w-full flex items-center justify-between px-4 py-2 border-b border-border bg-background">
      <div>
        {showBack && (
          <Link href="/dashboard">
            <Button variant="outline" className="text-lg">Back to Dashboard</Button>
          </Link>
        )}
      </div>
      <ThemeToggle />
    </header>
  );
} 