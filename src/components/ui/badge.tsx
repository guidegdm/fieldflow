import { forwardRef } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full font-medium leading-none",
  {
    variants: {
      variant: {
        default: "bg-graph-paper text-chart-gray",
        success: "bg-success-500/10 text-success-500",
        warning: "bg-warning-500/10 text-warning-500",
        danger: "bg-danger-500/10 text-danger-500",
        info: "bg-info-500/10 text-info-500",
      },
      size: {
        sm: "h-5 px-2 text-xs",
        md: "h-6 px-2.5 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

const dotVariants = cva("h-1.5 w-1.5 rounded-full", {
  variants: {
    variant: {
      default: "bg-chart-gray",
      success: "bg-success-500",
      warning: "bg-warning-500",
      danger: "bg-danger-500",
      info: "bg-info-500",
    },
  },
  defaultVariants: { variant: "default" },
})

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, children, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ variant, size, className }))} {...props}>
      <span className={cn(dotVariants({ variant }))} />
      {children}
    </span>
  )
)
Badge.displayName = "Badge"

export { Badge, badgeVariants }
