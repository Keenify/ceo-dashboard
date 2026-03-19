import * as React from "react";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={`border rounded-md p-2 w-full ${className}`}
    {...props}
  />
));

Textarea.displayName = "Textarea";

export { Textarea }; 