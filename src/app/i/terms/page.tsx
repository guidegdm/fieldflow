export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 text-ink-black leading-relaxed">
      <h1 className="font-display text-3xl font-bold text-lake-deep mb-6">Conditions d&apos;utilisation</h1>
      <p className="text-pencil text-sm mb-4">Derni&egrave;re mise &agrave; jour : 27 juin 2026</p>
      <Section title="1. Service">
        FieldFlow est une plateforme de workflows humanitaires hors ligne fournie &quot;en l&apos;&eacute;tat&quot; pour les ONG et agences de sant&eacute;.
      </Section>
      <Section title="2. Comptes">
        Vous &ecirc;tes responsable de la s&eacute;curit&eacute; de votre compte. Les administrateurs g&egrave;rent les utilisateurs.
      </Section>
      <Section title="3. Utilisation acceptable">
        FieldFlow doit &ecirc;tre utilis&eacute; pour des op&eacute;rations humanitaires l&eacute;gitimes.
      </Section>
      <Section title="4. Propri&eacute;t&eacute; des donn&eacute;es">
        Les organisations conservent la pleine propri&eacute;t&eacute; de leurs donn&eacute;es.
      </Section>
      <Section title="5. Limitation de responsabilit&eacute;">
        FieldFlow est fourni sans garantie. Nous ne sommes pas responsables des d&eacute;cisions op&eacute;rationnelles.
      </Section>
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
