export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 text-ink-black leading-relaxed">
      <h1 className="font-display text-3xl font-bold text-lake-deep mb-6">Politique de confidentialit&eacute;</h1>
      <p className="text-pencil text-sm mb-4">Derni&egrave;re mise &agrave; jour : 27 juin 2026</p>
      <Section title="1. Donn&eacute;es collect&eacute;es">
        FieldFlow collecte les informations n&eacute;cessaires au fonctionnement des workflows humanitaires : noms, coordonn&eacute;es, photos, signatures, et donn&eacute;es de formulaire.
      </Section>
      <Section title="2. Utilisation des donn&eacute;es">
        Les donn&eacute;es sont utilis&eacute;es exclusivement pour les op&eacute;rations humanitaires. Aucune donn&eacute;e n&apos;est vendue &agrave; des tiers.
      </Section>
      <Section title="3. Stockage et s&eacute;curit&eacute;">
        Les donn&eacute;es sont stock&eacute;es sur AWS (DynamoDB) avec chiffrement. Les jetons utilisent des cookies HttpOnly.
      </Section>
      <Section title="4. Contact">privacy@fieldflow.dev</Section>
      <p className="mt-12 text-xs text-pencil">FieldFlow &mdash; Construit pour les op&eacute;rations humanitaires au Kivu.</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-8">
      <h2 className="font-serif text-lg font-semibold text-soil mb-3">{title}</h2>
      <p className="text-sm text-ink-black">{children}</p>
    </div>
  )
}
