"use client";

import { AppHeader } from "@/components/ui/AppHeader";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <AppHeader>
      {children}
    </AppHeader>
  );
} 