"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const sidebarVariants = cva(
  "flex h-full w-full flex-col overflow-hidden bg-background",
  {
    variants: {
      variant: {
        default: "border-r",
        floating: "rounded-lg border shadow-lg",
        inset: "rounded-lg border bg-sidebar",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface SidebarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof sidebarVariants> {
  collapsed?: boolean;
}

const Sidebar = React.forwardRef<HTMLDivElement, SidebarProps>(
  ({ className, variant, collapsed = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          sidebarVariants({ variant, className }),
          collapsed ? "w-16" : "w-64",
          "transition-all duration-300 ease-in-out"
        )}
        {...props}
      />
    );
  }
);
Sidebar.displayName = "Sidebar";

const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex h-16 items-center border-b px-4", className)}
    {...props}
  />
));
SidebarHeader.displayName = "SidebarHeader";

const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex-1 overflow-y-auto py-2", className)}
    {...props}
  />
));
SidebarContent.displayName = "SidebarContent";

const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("border-t px-4 py-2", className)}
    {...props}
  />
));
SidebarFooter.displayName = "SidebarFooter";

const SidebarGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("px-3 py-2", className)}
    {...props}
  />
));
SidebarGroup.displayName = "SidebarGroup";

const SidebarGroupLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "px-2 py-1.5 text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wide",
      className
    )}
    {...props}
  />
));
SidebarGroupLabel.displayName = "SidebarGroupLabel";

const SidebarGroupContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("grid gap-1", className)}
    {...props}
  />
));
SidebarGroupContent.displayName = "SidebarGroupContent";

interface SidebarMenuItemProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
  href?: string;
  icon?: React.ElementType;
  active?: boolean;
  collapsed?: boolean;
  isSubItem?: boolean;
}

const SidebarMenuItem = React.forwardRef<HTMLDivElement, SidebarMenuItemProps>(
  ({ className, asChild = false, href, icon: Icon, active, collapsed, isSubItem = false, children, ...props }, ref) => {
    const Comp = asChild ? React.Fragment : href ? "a" : "div";
    const itemProps = href ? { href } : {};
    
    return (
      <div ref={ref} className={cn("relative", className)} {...props}>
        <Comp
          {...itemProps}
          className={cn(
            "flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-all hover:bg-accent hover:text-accent-foreground",
            active && "bg-accent text-accent-foreground",
            collapsed && "justify-center px-2",
            // Indentation for sub-items (modules under categories)
            !collapsed && isSubItem && "ml-4 px-2 text-muted-foreground border-l-2 border-muted",
            !collapsed && !isSubItem && "px-3",
            className
          )}
        >
          {Icon && <Icon className={cn("h-4 w-4 flex-shrink-0", isSubItem && "h-3 w-3")} />}
          {!collapsed && <span className="truncate">{children}</span>}
        </Comp>
      </div>
    );
  }
);
SidebarMenuItem.displayName = "SidebarMenuItem";

const SidebarTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 w-9",
      className
    )}
    {...props}
  />
));
SidebarTrigger.displayName = "SidebarTrigger";

export {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenuItem,
  SidebarTrigger,
}; 