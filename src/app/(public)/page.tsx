import Link from "next/link"
import { ArrowRight, Boxes, GitBranch, RadioTower, ShieldCheck, Waypoints } from "lucide-react"

const metrics = [
  { label: "Local-first records", value: "IndexedDB" },
  { label: "Primary backend", value: "DynamoDB" },
  { label: "Demo isolation", value: "TTL workspaces" },
]

const workflow = [
  "Design workflow",
  "Install PWA",
  "Work offline",
  "Sync operations",
  "Resolve conflicts",
  "Audit decisions",
]

const capabilities = [
  {
    icon: RadioTower,
    title: "Network-tolerant operations",
    body: "Field teams keep registering households, evidence, and decisions when the connection disappears.",
  },
  {
    icon: GitBranch,
    title: "Conflict-aware sync",
    body: "Changes carry base values and workflow versions, so supervisors can see what changed instead of losing work.",
  },
  {
    icon: Boxes,
    title: "Transactional inventory",
    body: "DynamoDB transactions protect critical reservations with idempotency receipts and conditional stock updates.",
  },
  {
    icon: ShieldCheck,
    title: "Tenant-safe demo workspaces",
    body: "Every anonymous demo install receives private org copies, while DynamoDB TTL prepares cleanup.",
  },
]

export default function LandingPage() {
  return (
    <div className="bg-graph-paper text-ink-black">
      <section className="relative isolate overflow-hidden border-b border-grid-line">
        <img
          src="/brand/fieldflow-logo-square.webp"
          alt=""
          className="pointer-events-none absolute right-[-7rem] top-8 z-0 h-[34rem] w-[34rem] opacity-[0.13] md:right-8 md:top-10 md:opacity-[0.18]"
        />
        <div className="absolute inset-0 z-0 bg-[linear-gradient(#E5E7EB_1px,transparent_1px),linear-gradient(90deg,#E5E7EB_1px,transparent_1px)] bg-[size:96px_96px] opacity-60" />

        <div className="relative z-10 mx-auto flex min-h-[78vh] max-w-6xl flex-col justify-center px-6 py-20">
          <p className="mb-5 inline-flex w-fit items-center gap-2 rounded-sm border border-grid-line bg-white/75 px-3 py-1 font-mono text-xs uppercase tracking-[0.16em] text-chart-gray">
            <Waypoints size={14} />
            Vercel + Amazon DynamoDB
          </p>
          <h1 className="max-w-4xl font-display text-5xl font-bold leading-[1.02] tracking-tight text-lake-deep md:text-7xl">
            Field operations that keep moving when the network does not.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-soil">
            FieldFlow turns operational workflows into offline-first PWAs with DynamoDB-backed sync,
            conflict review, tenant isolation, and transactional inventory controls.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/demo"
              className="inline-flex h-11 items-center gap-2 rounded-md bg-ink-blue px-5 text-sm font-semibold text-white transition-colors hover:bg-ink-blue/90"
            >
              Try the live demo
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/auth/signup"
              className="inline-flex h-11 items-center rounded-md border border-ink-blue px-5 text-sm font-semibold text-ink-blue transition-colors hover:bg-ink-blue/5"
            >
              Create workspace
            </Link>
          </div>

          <dl className="mt-14 grid max-w-4xl grid-cols-1 border-y border-grid-line bg-white/70 md:grid-cols-3">
            {metrics.map((metric) => (
              <div key={metric.label} className="border-grid-line px-5 py-4 md:border-r md:last:border-r-0">
                <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-chart-gray">{metric.label}</dt>
                <dd className="mt-1 font-display text-xl font-semibold text-lake-deep">{metric.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="border-b border-grid-line bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-chart-gray">Operational loop</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-lake-deep">
              One workflow, many unreliable devices, one auditable truth.
            </h2>
          </div>
          <ol className="grid gap-px border border-grid-line bg-grid-line md:grid-cols-3">
            {workflow.map((step, index) => (
              <li key={step} className="bg-graph-paper p-5">
                <span className="font-mono text-xs text-chart-gray">{String(index + 1).padStart(2, "0")}</span>
                <p className="mt-3 text-sm font-semibold text-ink-black">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-kivu-paper">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-px border border-grid-line bg-grid-line md:grid-cols-2">
            {capabilities.map((item) => (
              <article key={item.title} className="bg-kivu-paper p-6">
                <item.icon className="h-6 w-6 text-lake-deep" />
                <h3 className="mt-5 font-display text-xl font-semibold text-lake-deep">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-soil">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-grid-line bg-ink-black text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-starlight">Judge-ready demo</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight">Test it without asking for credentials.</h2>
          </div>
          <Link
            href="/demo"
            className="inline-flex h-11 w-fit items-center gap-2 rounded-md bg-white px-5 text-sm font-semibold text-ink-black transition-colors hover:bg-starlight"
          >
            Open demo workspace
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  )
}
