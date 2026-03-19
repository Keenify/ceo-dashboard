"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Settings, LogOut, LayoutDashboard, EyeOff, Eye } from 'lucide-react';
import { AppSidebar } from "@/components/ui/app-sidebar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { MODULE_CATEGORIES } from "@/app/dashboard/constants/moduleCategories";
import { ALL_MODULES } from "@/app/dashboard/constants/moduleMapping";

interface AppHeaderProps {
  children?: React.ReactNode;
}

export function AppHeader({ children }: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthPage = ["/login", "/register", "/forgot-password", "/reset-password", "/auth/callback"].includes(pathname);
  const isDashboardPage = pathname === "/dashboard";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  // Note: Recovery session handling is done in the reset-password page itself
  // to avoid interference with the password reset flow

  // For auth pages (login, register, forgot-password, reset-password), return children without any header/sidebar wrapper
  if (isAuthPage) {
    return <>{children}</>;
  }

  const handleDesktopToggle = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const handleMobileToggle = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleSignOut = async () => {
    try {
      // Sign out without redirect first
      await supabase.auth.signOut({ scope: 'local' });
      
      // Then manually redirect to login on the current domain
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
      router.push("/login");
      
      // Force a page refresh to clear any cached auth state
      if (typeof window !== 'undefined') {
        window.location.href = `${currentOrigin}/login`;
      }
    } catch (error) {
      console.error('Error signing out:', error);
      // Fallback: still try to redirect to login
      router.push("/login");
    }
  };

  // Filter modules by search
  const filteredModules = search.trim()
    ? ALL_MODULES.filter(m => m.title.toLowerCase().includes(search.toLowerCase()))
    : ALL_MODULES;

  // Handle navigation
  const handleModuleClick = (href: string) => {
    setDropdownOpen(false);
    setSearch("");
    router.push(href);
  };

  // Custom triangle-rounded search bar style
  const searchBarClass = `relative flex items-center bg-white border-2 border-black px-4 py-2 text-sm focus-within:shadow-lg focus-within:ring-2 focus-within:ring-black transition-all duration-150 outline-none
    rounded-[2rem_2rem_1rem_2rem]`;

  return (
    <div className="flex flex-col h-screen">
      {/* Header visibility toggle button (always visible) */}
      {!headerVisible && (
        <button
          onClick={() => setHeaderVisible(true)}
          className="fixed top-2 right-2 z-50 p-2 rounded-lg bg-card border border-border shadow-lg hover:bg-accent transition-colors"
          aria-label="Show header"
        >
          <Eye className="h-4 w-4" />
        </button>
      )}

      {/* Top Header Bar */}
      {headerVisible && (
        <div className="flex items-center justify-between h-16 px-4 bg-card border-b border-border shrink-0 relative z-10">
          {/* Left: Dashboard link and mobile menu */}
          <div className="flex items-center gap-2 flex-1">
            {!isDashboardPage && (
              <div className="lg:hidden">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-2 rounded-lg hover:bg-accent transition-colors"
                  aria-label="Open sidebar"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </div>
            )}
            <Link 
              href="/dashboard" 
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent transition-colors"
            >
              <LayoutDashboard className="h-5 w-5" />
              <span className="font-medium">Dashboard</span>
            </Link>
          </div>

          {/* Center: Title (visible on mobile when no sidebar) */}
          <div className="lg:hidden">
            {isDashboardPage && <h1 className="text-lg font-semibold">CEO Dashboard</h1>}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* Search Bar - left of EyeOff icon */}
            <div className="relative mr-2">
              <input
                type="text"
                className={searchBarClass + (inputFocused ? " ring-2 ring-black border-2 border-black" : "")}
                placeholder="Search modules..."
                value={search}
                onChange={e => { setSearch(e.target.value); setDropdownOpen(true); }}
                onFocus={() => { setInputFocused(true); setDropdownOpen(true); }}
                onBlur={() => { setInputFocused(false); setTimeout(() => setDropdownOpen(false), 150); }}
                style={{ width: 220, borderRadius: '2rem 2rem 1rem 2rem/2rem 2rem 1rem 2rem' }}
              />
              {/* Dropdown */}
              {dropdownOpen && (
                <div className="absolute left-0 mt-2 w-[320px] max-h-80 overflow-y-auto bg-white border border-black rounded-lg shadow-lg z-[9999]" style={{top: '100%'}}>
                  {filteredModules.length === 0 ? (
                    <div className="px-4 py-2 text-gray-400">No modules found</div>
                  ) : (
                    filteredModules.map(module => (
                      <div
                        key={module.href}
                        className="flex items-center justify-between px-4 py-2 hover:bg-gray-100 cursor-pointer"
                        onMouseDown={() => handleModuleClick(module.href)}
                      >
                        <span>{module.title}</span>
                        <a
                          href={module.href}
                          className="text-blue-500 text-xs ml-2 whitespace-nowrap"
                          onClick={e => { e.preventDefault(); handleModuleClick(module.href); }}
                        >
                          {module.href}
                        </a>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <button
              onClick={() => setHeaderVisible(false)}
              className="h-10 w-10 p-0 rounded-lg flex items-center justify-center hover:bg-accent transition-colors"
              aria-label="Hide header"
            >
              <EyeOff className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
            </button>
            <ThemeToggle />
            <Link 
              href="/settings" 
              className="h-10 w-10 p-0 rounded-lg flex items-center justify-center hover:bg-accent transition-colors"
              aria-label="Settings"
            >
              <Settings className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
            </Link>
            <button
              onClick={handleSignOut}
              className="h-10 w-10 p-0 rounded-lg flex items-center justify-center hover:bg-accent transition-colors"
              aria-label="Sign out"
            >
              <LogOut className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
            </button>
          </div>
        </div>
      )}

      {/* Main content area with sidebar */}
      <div className={`flex flex-1 overflow-hidden ${!headerVisible ? 'h-screen' : ''}`}>
        {/* Desktop Sidebar - Only show when NOT on dashboard page */}
        {!isDashboardPage && (
          <div className="hidden lg:block">
            <AppSidebar 
              collapsed={sidebarCollapsed}
              onToggle={handleDesktopToggle}
            />
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>

      {/* Mobile Sidebar - Only show when NOT on dashboard page */}
      {!isDashboardPage && (
        <>
          <div className={`
            lg:hidden
            ${sidebarOpen ? 'block' : 'hidden'}
            fixed
            inset-y-0 left-0
            z-50
            w-64
          `}>
            <AppSidebar 
              collapsed={false}
              onToggle={handleMobileToggle}
            />
          </div>

          {/* Mobile overlay */}
          {sidebarOpen && (
            <div 
              className="lg:hidden fixed inset-0 bg-black/50 z-40"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </>
      )}
    </div>
  );
} 