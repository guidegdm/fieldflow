import { forwardRef } from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  id?: string
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const textareaId = id || props.name
    return (
      <div>
        {label && (
          <label htmlFor={textareaId} className="block text-sm font-medium text-pencil mb-1">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            "flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm text-ink-black placeholder:text-pencil/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-blue focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 resize-y",
            error ? "border-danger-500" : "border-graph-line",
            className
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${textareaId}-error` : undefined}
          {...props}
        />
        {error && (
          <p id={`${textareaId}-error`} className="text-sm text-danger-500 mt-1" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
