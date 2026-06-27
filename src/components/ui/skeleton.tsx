import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-md bg-gradient-to-r from-graph-line/60 via-graph-line/30 to-graph-line/60 bg-[length:200%_100%] animate-skeleton", className)} {...props} />
}

export { Skeleton }
