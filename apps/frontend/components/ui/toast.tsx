"use client"

import { Toaster as SonnerToaster } from "sonner"

type ToasterProps = React.ComponentProps<typeof SonnerToaster>

export function Toaster({ ...props }: ToasterProps) {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        classNames: {
          toast:
            "group border border-border bg-background text-foreground flex p-4 rounded-md shadow-lg",
          title: "text-sm font-semibold [&+div]:text-xs",
          description: "text-sm",
          actionButton:
            "bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-sm",
          cancelButton:
            "bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-sm",
          error:
            "border-red-600 bg-red-50 dark:bg-red-950/50 text-red-900 dark:text-red-100 [&>div>svg]:text-red-600",
          success:
            "border-green-600 bg-green-50 dark:bg-green-950/50 text-green-900 dark:text-green-100 [&>div>svg]:text-green-600",
          warning:
            "border-yellow-600 bg-yellow-50 dark:bg-yellow-950/50 text-yellow-900 dark:text-yellow-100 [&>div>svg]:text-yellow-600",
          info:
            "border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-900 dark:text-blue-100 [&>div>svg]:text-blue-600",
        },
      }}
      {...props}
    />
  )
}

// Re-export toast function from sonner
export { toast } from "sonner" 