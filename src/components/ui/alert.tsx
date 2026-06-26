import { forwardRef } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { AlertCircle, AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-md border border-graph-line p-4 [&>svg~*]:pl-8 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:h-4 [&>svg]:w-4",
  {
    variants: {
      variant: {
        default: "border-l-[3px] border-l-chart-gray bg-white text-ink-black",
        info: "border-l-[3px] border-l-info-500 bg-info-500/5 text-ink-black",
        success: "border-l-[3px] border-l-success-500 bg-success-500/5 text-ink-black",
        warning: "border-l-[3px] border-l-warning-500 bg-warning-500/5 text-ink-black",
        danger: "border-l-[3px] border-l-danger-500 bg-danger-500/5 text-ink-black",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

const iconMap: Record<string, typeof Info> = {
  default: AlertCircle,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
}

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {}

const Alert = forwardRef<HTMLDivElement, AlertProps>(({ className, variant = "default", children, ...props }, ref) => {
  const Icon = iconMap[variant ?? "default"]
  return (
    <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      <Icon />
      {children}
    </div>
  )
})
Alert.displayName = "Alert"

const AlertTitle = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn("mb-1 font-medium leading-none tracking-tight text-ink-black", className)} {...props} />
  )
)
AlertTitle.displayName = "AlertTitle"

const AlertDescription = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm text-pencil [&_p]:leading-relaxed", className)} {...props} />
  )
)
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
