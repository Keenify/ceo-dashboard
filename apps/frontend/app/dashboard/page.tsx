"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { AlertCircle, Grid3X3, List, ChevronDown, ChevronUp, Maximize2, Minimize2, LayoutDashboard } from 'lucide-react';
import { useModuleStatus, ModuleStatusResponse } from './services/useModuleStatus';
import { useUserModules, UserModulesResponse } from './services/useUserModules';
import { ModuleCard } from '@/components/dashboard/ModuleCard';
import { ADMIN_EMAILS, ALL_MODULES, PRODUCT_ID_TO_MODULE } from './constants/moduleMapping';
import { MODULE_CATEGORIES, CATEGORY_ICONS, CATEGORY_COLORS } from './constants/moduleCategories';

type ViewMode = 'grid' | 'list';
type CardMode = 'compact' | 'full';
type SortBy = 'name' | 'category' | 'status';
type FilterBy = 'all' | 'purchased' | 'available';

// Separate component that handles search params
function DashboardContent() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [moduleStatus, setModuleStatus] = useState<ModuleStatusResponse | null>(null);
  const [userModules, setUserModules] = useState<UserModulesResponse[]>([]);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [filterBy, setFilterBy] = useState<FilterBy>('all');
  const [sortBy, setSortBy] = useState<SortBy>('category');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [cardMode, setCardMode] = useState<CardMode>('compact');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(Object.keys(MODULE_CATEGORIES)));
  const [searchTerm, setSearchTerm] = useState('');
  const [searchFrequency, setSearchFrequency] = useState<Record<string, number>>({});
  const [isSearchBarFocused, setIsSearchBarFocused] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);

  const { fetchModuleStatusToday, loading: statusLoading, error: statusError } = useModuleStatus();
  const { getActiveUserModules, loading: modulesLoading, error: modulesError } = useUserModules();

  // Handle search term from URL
  useEffect(() => {
    const search = searchParams?.get('search');
    if (search) {
      setSearchTerm(search);
    }
  }, [searchParams]);

  useEffect(() => {
    const getUserAndStatus = async () => {
      setLoading(true);
      const { data, error } = await supabase.auth.getUser();
      
      if (error || !data?.user) {
        router.push("/login");
        return;
      }
      
      setUser(data.user);

      // Check if user is admin
      const userEmail = data.user.email;
      const isAdmin = Boolean(userEmail && ADMIN_EMAILS.includes(userEmail as any));
      setIsAdminUser(isAdmin);

      if (data.user.id) {
        // Fetch module status for all users
        const status = await fetchModuleStatusToday(data.user.id);
        setModuleStatus(status);
        if (statusError) {
            console.error("Error fetching module status:", statusError);
        }

        // If not admin, fetch user's subscribed modules
        if (!isAdmin) {
          const modules = await getActiveUserModules(data.user.id);
          if (modules) {
            setUserModules(modules);
            // Console log product IDs
            const productIds = modules.map(module => module.product_id);
            console.log("User's subscribed product IDs:", productIds);
            productIds.forEach(productId => {
              console.log(`Product ID: ${productId}`);
            });
          }
          if (modulesError) {
            console.error("Error fetching user modules:", modulesError);
          }
        }
      }

      setLoading(false);
    };

    getUserAndStatus();
  }, [router, fetchModuleStatusToday, getActiveUserModules]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const getModulesByCategory = (category: string) => {
    const categoryModules = MODULE_CATEGORIES[category as keyof typeof MODULE_CATEGORIES];
    return ALL_MODULES.filter(module => (categoryModules as readonly string[]).includes(module.title));
  };

  const getModuleCompletionStatus = (module: any) => {
    if (!module.statusKey || !moduleStatus) return null;
    return moduleStatus[module.statusKey as keyof ModuleStatusResponse];
  };

  const isModulePurchased = (module: any) => {
    return true;
  };

  const filteredModules = (modules: any[]) => {
    let filtered = modules;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(module => 
        module.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        module.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply category filter
    if (filterBy !== 'all') {
      filtered = filtered.filter(module => {
        const isPurchased = isModulePurchased(module);
        
        switch (filterBy) {
          case 'purchased':
            return isPurchased;
          case 'available':
            return !isPurchased;
          default:
            return true;
        }
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.title.localeCompare(b.title);
        case 'status':
          const aStatus = getModuleCompletionStatus(a);
          const bStatus = getModuleCompletionStatus(b);
          if (aStatus === bStatus) return 0;
          if (aStatus === null) return 1;
          if (bStatus === null) return -1;
          return aStatus ? 1 : -1;
        default:
          return 0;
      }
    });

    return filtered;
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="bg-background p-4 overflow-hidden" ref={containerRef}>
      <div className="mx-auto max-w-7xl overflow-hidden px-6 py-4 my-4">
        {/* Search Bar */}
        {/* Search Results Header */}
        {searchTerm && (
          <div className="mb-6 p-4 bg-accent/50 rounded-lg border border-border">
            <h2 className="text-lg font-semibold mb-2">Search Results for "{searchTerm}"</h2>
            <button
              onClick={() => {
                setSearchTerm('');
                router.push('/dashboard');
              }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear search and show all modules
            </button>
          </div>
        )}
        {/* Display error messages */}
        {statusError && !statusLoading && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" /> 
            <span>Failed to load module completion status: {statusError.message}</span>
          </div>
        )}
        {modulesError && !modulesLoading && !isAdminUser && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" /> 
            <span>Failed to load user modules: {modulesError.message}</span>
          </div>
        )}
        {/* All Module Categories */}
        <div className="space-y-6">
          {Object.entries(MODULE_CATEGORIES).map(([category, moduleNames]) => {
            const categoryModules = filteredModules(getModulesByCategory(category));
            if (categoryModules.length === 0) return null;
            return (
              <div key={category} className="space-y-4 p-4 rounded-lg transition-all duration-300 hover:bg-gray-50 hover:shadow-lg hover:border hover:border-gray-200 dark:hover:bg-gray-800 dark:hover:border-gray-700">
                <div className="border-t border-border mb-4"></div>
                <div className="flex gap-6">
                  {/* Category Header */}
                  <div className="flex items-center gap-3 p-5 rounded-lg transition-all duration-200 flex-shrink-0 w-80 min-w-80">
                    <span className="text-3xl font-bold text-foreground break-words">
                      {CATEGORY_ICONS[category as keyof typeof CATEGORY_ICONS]} {category}
                    </span>
                  </div>
                  {/* Category Modules - Always Visible */}
                  <div className={`grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 flex-1`}>
                    {categoryModules.map((module, index) => {
                      const isPurchased = isModulePurchased(module);
                      return (
                        <ModuleCard
                          key={`${category}-${index}`}
                          href={isPurchased ? module.href : "#"}
                          title={module.title}
                          description={module.description}
                          icon={module.icon}
                          borderColor={isPurchased ? module.borderColor : "border-muted-foreground/20"}
                          iconColor={isPurchased ? module.iconColor : "text-muted-foreground/50"}
                          completed={getModuleCompletionStatus(module)}
                          disabled={!isPurchased}
                          compact={cardMode === 'compact'}
                          listView={viewMode === 'list'}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {/* Show message if no modules match filters */}
        {Object.values(MODULE_CATEGORIES).every(moduleNames => 
          filteredModules(getModulesByCategory(Object.keys(MODULE_CATEGORIES).find(key => 
            MODULE_CATEGORIES[key as keyof typeof MODULE_CATEGORIES] === moduleNames
          ) || '')).length === 0
        ) && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">
              {searchTerm 
                ? `No modules found matching "${searchTerm}".` 
                : "No modules found matching your criteria."
              }
            </p>
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  router.push('/dashboard');
                }}
                className="mt-2 text-sm text-primary hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        )}
        
      </div>
    </div>
  );
}

// Loading fallback component
function DashboardLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p>Loading dashboard...</p>
    </div>
  );
}

// Main page component with Suspense boundary
export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent />
    </Suspense>
  );
} 