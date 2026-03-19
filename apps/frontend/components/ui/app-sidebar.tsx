"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Menu, 
  ChevronDown, 
  ChevronRight
} from 'lucide-react';
import { useUserModules, UserModulesResponse } from "@/app/dashboard/services/useUserModules";
import { ADMIN_EMAILS, ALL_MODULES, PRODUCT_ID_TO_MODULE } from "@/app/dashboard/constants/moduleMapping";
import { MODULE_CATEGORIES, CATEGORY_ICONS, type ModuleCategoryKey } from "@/app/dashboard/constants/moduleCategories";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar";

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface ModuleInfo {
  href: string;
  title: string;
  icon: React.ElementType;
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const pathname = usePathname();
  
  const [user, setUser] = useState<any>(null);
  const [userModules, setUserModules] = useState<UserModulesResponse[]>([]);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [modulesByCategory, setModulesByCategory] = useState<Record<string, ModuleInfo[]>>({});
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(Object.keys(MODULE_CATEGORIES)));
  
  const { getActiveUserModules } = useUserModules();

  useEffect(() => {
    const fetchUserAndModules = async () => {
      const { data, error } = await supabase.auth.getUser();
      
      if (error || !data?.user) {
        setModulesByCategory({});
        return;
      }
      
      setUser(data.user);

      // Check if user is admin
      const userEmail = data.user.email;
      const isAdmin = Boolean(userEmail && ADMIN_EMAILS.includes(userEmail as any));
      setIsAdminUser(isAdmin);

      let availableModules: ModuleInfo[] = [];

      if (isAdmin) {
        // Admin users see ALL modules
        availableModules = ALL_MODULES.map(module => ({
          href: module.href,
          title: module.title,
          icon: module.icon
        }));
      } else {
        // Regular users see only their subscribed modules
        const modules = await getActiveUserModules(data.user.id);
        if (modules) {
          setUserModules(modules);
          availableModules = modules
            .map(userModule => {
              const moduleConfig = PRODUCT_ID_TO_MODULE[userModule.product_id as keyof typeof PRODUCT_ID_TO_MODULE];
              if (!moduleConfig) {
                console.warn(`No module configuration found for product ID: ${userModule.product_id}`);
                return null;
              }
              return {
                href: moduleConfig.href,
                title: moduleConfig.title,
                icon: moduleConfig.icon
              };
            })
            .filter(Boolean) as ModuleInfo[];
        }
      }

      // Organize modules by category
      const organizedModules: Record<string, ModuleInfo[]> = {};
      
      Object.entries(MODULE_CATEGORIES).forEach(([category, moduleNames]) => {
        const categoryModules = availableModules.filter(module => 
          (moduleNames as readonly string[]).includes(module.title)
        );
        if (categoryModules.length > 0) {
          organizedModules[category] = categoryModules;
        }
      });

      setModulesByCategory(organizedModules);
    };

    fetchUserAndModules();
  }, [getActiveUserModules]);

  const toggleCategory = (category: string) => {
    if (collapsed) return; // Don't toggle when collapsed
    
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  return (
    <Sidebar collapsed={collapsed} className="border-r bg-card">
      {/* Header */}
      <SidebarHeader className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SidebarTrigger onClick={onToggle}>
            <Menu className="h-4 w-4" />
          </SidebarTrigger>
          {!collapsed && (
            <span className="font-semibold text-foreground">Modules</span>
          )}
        </div>
      </SidebarHeader>

      {/* Content */}
      <SidebarContent>
        {Object.entries(modulesByCategory).map(([category, modules]) => {
          const isExpanded = expandedCategories.has(category);
          const categoryIcon = CATEGORY_ICONS[category as ModuleCategoryKey];
          
          return (
            <SidebarGroup key={category}>
              {!collapsed && (
                <button
                  onClick={() => toggleCategory(category)}
                  className="flex w-full items-center justify-between px-3 py-2 text-sm font-semibold text-foreground hover:bg-accent rounded-lg transition-colors mb-1"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-base">{categoryIcon}</span>
                    <span>{category}</span>
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              )}
              
              {(collapsed || isExpanded) && (
                <SidebarGroupContent className="space-y-1">
                  {modules.map((module) => (
                    <Link key={module.href} href={module.href}>
                      <SidebarMenuItem 
                        icon={module.icon}
                        active={pathname === module.href}
                        collapsed={collapsed}
                        isSubItem={true}
                        className="cursor-pointer"
                      >
                        {module.title}
                      </SidebarMenuItem>
                    </Link>
                  ))}
                </SidebarGroupContent>
              )}
            </SidebarGroup>
          );
        })}
      </SidebarContent>


    </Sidebar>
  );
} 