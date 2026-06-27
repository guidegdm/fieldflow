import Link from "next/link"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-kivu-paper">
      <section className="max-w-3xl mx-auto px-6 pt-24 pb-16">
        <h1 className="font-display text-[56px] leading-[1.1] font-bold text-lake-deep tracking-tight">
          Des outils humanitaires
          <br />
          qui fonctionnent sans Internet.
        </h1>
        <p className="mt-6 font-serif text-lg text-soil leading-relaxed max-w-xl">
          Créez des workflows, déployez sur le terrain, synchronisez quand le réseau revient.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/demo"
            className="inline-flex items-center rounded-md bg-ink-blue text-white px-6 py-3 font-medium text-sm hover:bg-ink-blue/90 transition-colors"
          >
            Essayer la démo
          </Link>
          <Link
            href="/auth/signup"
            className="inline-flex items-center rounded-md border border-ink-blue text-ink-blue px-6 py-3 font-medium text-sm hover:bg-ink-blue/5 transition-colors"
          >
            Créer un compte
          </Link>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="border-t-2 border-lake-deep pt-4">
            <h3 className="font-display text-lg font-semibold text-lake-deep">Hors ligne</h3>
            <p className="mt-2 text-sm text-soil leading-relaxed">
              Fonctionne sans connexion Internet
            </p>
          </div>
          <div className="border-t-2 border-lake-deep pt-4">
            <h3 className="font-display text-lg font-semibold text-lake-deep">Workflows</h3>
            <p className="mt-2 text-sm text-soil leading-relaxed">
              Créez des formulaires sans code
            </p>
          </div>
          <div className="border-t-2 border-lake-deep pt-4">
            <h3 className="font-display text-lg font-semibold text-lake-deep">Sécurisé</h3>
            <p className="mt-2 text-sm text-soil leading-relaxed">
              Authentification forte
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-grid-line bg-white">
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <h2 className="font-display text-3xl font-bold text-lake-deep tracking-tight">Comment ça marche</h2>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-ink-blue text-white font-display text-lg font-bold">
                1
              </span>
              <p className="mt-3 font-display text-lg font-semibold text-soil">Créer</p>
            </div>
            <div>
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-ink-blue text-white font-display text-lg font-bold">
                2
              </span>
              <p className="mt-3 font-display text-lg font-semibold text-soil">Déployer</p>
            </div>
            <div>
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-ink-blue text-white font-display text-lg font-bold">
                3
              </span>
              <p className="mt-3 font-display text-lg font-semibold text-soil">Synchroniser</p>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-16 text-center">
        <h2 className="font-display text-3xl font-bold text-lake-deep tracking-tight">
          Prêt à équiper votre équipe ?
        </h2>
        <Link
          href="/auth/signup"
          className="mt-8 inline-flex items-center rounded-md bg-ink-blue text-white px-8 py-3 font-medium text-sm hover:bg-ink-blue/90 transition-colors"
        >
          Créer un compte gratuit
        </Link>
      </section>
    </div>
  )
}
