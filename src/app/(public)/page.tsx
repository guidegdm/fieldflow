"use client"

import Link from "next/link"
import { ArrowRight, Boxes, GitBranch, RadioTower, ShieldCheck } from "lucide-react"
import { useTranslation } from "react-i18next"
import { LandingInstallCta } from "@/components/public/LandingInstallCta"
import { LandingWorkspaceCta } from "@/components/public/LandingWorkspaceCta"

export default function LandingPage() {
  const { t } = useTranslation()
  const metrics = [
    { label: t("landing.metricLocal"), value: "IndexedDB" },
    { label: t("landing.metricBackend"), value: "DynamoDB" },
    { label: t("landing.metricDemo"), value: t("landing.metricDemoValue") },
  ]
  const workflow = [
    t("landing.loopStepDesign"),
    t("landing.loopStepInstall"),
    t("landing.loopStepOffline"),
    t("landing.loopStepSync"),
    t("landing.loopStepConflicts"),
    t("landing.loopStepAudit"),
  ]
  const capabilities = [
    {
      icon: RadioTower,
      title: t("landing.capabilityMissionTitle"),
      body: t("landing.capabilityMissionBody"),
    },
    {
      icon: GitBranch,
      title: t("landing.capabilityFieldworkTitle"),
      body: t("landing.capabilityFieldworkBody"),
    },
    {
      icon: Boxes,
      title: t("landing.capabilitySuppliesTitle"),
      body: t("landing.capabilitySuppliesBody"),
    },
    {
      icon: ShieldCheck,
      title: t("landing.capabilityDemoTitle"),
      body: t("landing.capabilityDemoBody"),
    },
  ]

  return (
    <div className="bg-graph-paper text-ink-black">
      <section className="relative isolate overflow-hidden border-b border-grid-line">
        <img
          src="/brand/fieldflow-logo-square.webp"
          alt=""
          className="pointer-events-none absolute right-0 top-8 z-0 h-96 w-96 opacity-[0.11] md:right-8 md:top-10 md:h-[34rem] md:w-[34rem] md:opacity-[0.18]"
        />
        <div className="absolute inset-0 z-0 bg-[linear-gradient(#E5E7EB_1px,transparent_1px),linear-gradient(90deg,#E5E7EB_1px,transparent_1px)] bg-[size:96px_96px] opacity-60" />

        <div className="relative z-10 mx-auto flex min-h-[78vh] max-w-6xl flex-col justify-center px-6 py-20">
          <h1 className="max-w-4xl font-display text-5xl font-bold leading-[1.02] tracking-tight text-lake-deep md:text-7xl">
            {t("landing.mainTitle")}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-soil">
            {t("landing.mainBody")}
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/demo"
              className="inline-flex h-11 items-center gap-2 rounded-md bg-ink-blue px-5 text-sm font-semibold text-white transition-colors hover:bg-ink-blue/90"
            >
              {t("landing.tryDemo")}
              <ArrowRight size={16} />
            </Link>
            <LandingWorkspaceCta />
            <LandingInstallCta />
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
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-chart-gray">{t("landing.loopEyebrow")}</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-lake-deep">
              {t("landing.loopTitle")}
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
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-starlight">{t("landing.bottomEyebrow")}</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight">{t("landing.bottomTitle")}</h2>
          </div>
          <Link
            href="/demo"
            className="inline-flex h-11 w-fit items-center gap-2 rounded-md bg-white px-5 text-sm font-semibold text-ink-black transition-colors hover:bg-starlight"
          >
            {t("landing.openDemo")}
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  )
}
