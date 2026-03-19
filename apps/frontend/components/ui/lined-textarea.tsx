import * as React from "react"
import { cn } from "@/lib/utils" // Assuming you have a cn utility like in shadcn/ui

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const LinedTextarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, style, ...props }, ref) => {
    // Define line height and calculate background size/position
    const lineHeight = 1.5; // Adjust this value based on your font size and desired line spacing (unit: em)
    const lineStyles = {
      lineHeight: `${lineHeight}em`,
      // Use background image for lines. Adjust color and thickness as needed.
      backgroundImage: `linear-gradient(to bottom, transparent ${lineHeight - 0.05}em, #e0e0e0 ${lineHeight - 0.05}em, #e0e0e0 ${lineHeight}em)`,
      backgroundSize: `100% ${lineHeight}em`,
      // Align background lines with text lines
      backgroundAttachment: 'local', // Ensures background scrolls with text
    };

    return (
      <textarea
        className={cn(
          // Remove border, background, focus ring, and vertical padding classes
          // "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          "flex w-full px-3 text-sm ring-offset-background placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50", // Keep horizontal padding, text, and disabled styles
          className // Allow overriding default classes
        )}
        ref={ref}
        style={{ ...lineStyles, border: 'none', outline: 'none', paddingTop: '2px', ...style }} // Add paddingTop
        {...props}
      />
    )
  }
)
LinedTextarea.displayName = "LinedTextarea"

export { LinedTextarea } 