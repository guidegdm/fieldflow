import Link from "next/link"

export const dynamic = 'force-dynamic'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-kivu-paper px-4">
      <div className="w-full max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-lake-deep">404</h1>
        <p className="mt-3 font-serif text-xl text-soil">Page non trouvée</p>
        <div className="mt-8 space-y-3 text-left">
          <p className="text-sm font-medium text-pencil">Où voulez-vous aller ?</p>
          <Link href="/" className="flex items-center gap-3 rounded-md border border-graph-line bg-white p-3 text-sm hover:bg-graph-paper">
            <span className="font-medium text-ink-black">Accueil</span>
            <span className="text-pencil">— Page d&apos;accueil FieldFlow</span>
          </Link>
          <Link href="/demo" className="flex items-center gap-3 rounded-md border border-graph-line bg-white p-3 text-sm hover:bg-graph-paper">
            <span className="font-medium text-ink-black">Démo</span>
            <span className="text-pencil">— Connexion rapide sans compte</span>
          </Link>
          <Link href="/auth/signin" className="flex items-center gap-3 rounded-md border border-graph-line bg-white p-3 text-sm hover:bg-graph-paper">
            <span className="font-medium text-ink-black">Connexion</span>
            <span className="text-pencil">— Se connecter à son organisation</span>
          </Link>
          <Link href="/auth/signup" className="flex items-center gap-3 rounded-md border border-graph-line bg-white p-3 text-sm hover:bg-graph-paper">
            <span className="font-medium text-ink-black">Créer un compte</span>
            <span className="text-pencil">— Créer une organisation</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
