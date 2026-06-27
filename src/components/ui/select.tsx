import { forwardRef } from "react"
import { cn } from "@/lib/utils"

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  id?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, children, ...props }, ref) => {
    const selectId = id || props.name
    return (
      <div>
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-pencil mb-1">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            "flex h-11 w-full rounded-md border bg-white px-3 py-2 text-sm text-ink-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-blue disabled:cursor-not-allowed disabled:opacity-50",
            error ? "border-danger-500" : "border-graph-line",
            className,
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${selectId}-error` : undefined}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p id={`${selectId}-error`} className="text-sm text-danger-500 mt-1" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  },
)
Select.displayName = "Select"

export { Select }
