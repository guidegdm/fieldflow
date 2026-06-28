export function AppLoader({ label = "FieldFlow" }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="relative h-14 w-14">
          <div className="absolute inset-0 rounded-full border border-graph-line" />
          <div className="absolute inset-1 rounded-full border-2 border-transparent border-t-ink-blue animate-spin" />
          <div className="absolute inset-4 rounded-full bg-ink-blue" />
        </div>
        <div>
          <p className="font-display text-xl font-semibold tracking-tight text-ink-black">
            {label}
          </p>
          <div className="mx-auto mt-3 flex w-20 justify-center gap-1.5" aria-hidden="true">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pencil/40" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pencil/40 [animation-delay:160ms]" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pencil/40 [animation-delay:320ms]" />
          </div>
        </div>
      </div>
    </div>
  )
}
