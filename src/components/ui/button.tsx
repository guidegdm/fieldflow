import { forwardRef } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex w-fit max-w-full shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-blue focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-ink-blue text-white hover:bg-ink-blue/90 active:bg-ink-blue/80",
        secondary: "border border-ink-blue text-ink-blue bg-transparent hover:bg-ink-blue/5",
        tertiary: "text-ink-blue bg-transparent hover:bg-ink-blue/5",
        danger: "bg-danger-500 text-white hover:bg-danger-500/90 active:bg-danger-500/80",
        ghost: "bg-transparent text-pencil hover:bg-graph-paper",
      },
      size: {
        sm: "min-h-8 px-3 py-1.5 text-sm",
        md: "min-h-10 px-4 py-2 text-sm",
        lg: "min-h-11 px-5 py-2.5 text-sm sm:text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
      {children}
    </button>
  )
)
Button.displayName = "Button"

export { Button, buttonVariants }
