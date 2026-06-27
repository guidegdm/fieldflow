export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: "720px", margin: "0 auto", padding: "48px 24px", fontFamily: "system-ui, sans-serif", lineHeight: 1.7, color: "#1F2937", background: "#FDF5E6" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 700, color: "#1B4F72", marginBottom: "24px" }}>Politique de confidentialité</h1>
      <p style={{ marginBottom: "16px" }}>Dernière mise à jour : 27 juin 2026</p>

      <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginTop: "32px", marginBottom: "12px" }}>1. Données collectées</h2>
      <p>FieldFlow collecte les informations nécessaires au fonctionnement des workflows humanitaires : noms, coordonnées GPS, photos, signatures, et données de formulaire saisies par les travailleurs de terrain.</p>

      <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginTop: "32px", marginBottom: "12px" }}>2. Utilisation des données</h2>
      <p>Les données sont utilisées exclusivement pour les opérations humanitaires : enregistrement des bénéficiaires, distribution d&apos;aide, coordination logistique, et audit opérationnel. Aucune donnée n&apos;est vendue à des tiers.</p>

      <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginTop: "32px", marginBottom: "12px" }}>3. Stockage et sécurité</h2>
      <p>Les données sont stockées sur Amazon Web Services (DynamoDB, Aurora DSQL) avec chiffrement au repos et en transit. Les jetons d&apos;authentification utilisent des cookies HttpOnly. Les mots de passe ne sont jamais stockés en clair.</p>

      <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginTop: "32px", marginBottom: "12px" }}>4. Conservation</h2>
      <p>Les données opérationnelles sont conservées selon les exigences de l&apos;organisation humanitaire. Les sessions expirent après 24 heures d&apos;inactivité.</p>

      <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginTop: "32px", marginBottom: "12px" }}>5. Vos droits</h2>
      <p>Vous pouvez demander l&apos;accès, la rectification ou la suppression de vos données en contactant votre administrateur d&apos;organisation.</p>

      <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginTop: "32px", marginBottom: "12px" }}>6. Contact</h2>
      <p>Pour toute question : privacy@fieldflow.dev</p>

      <p style={{ marginTop: "48px", fontSize: "0.875rem", color: "#6B7280" }}>FieldFlow — Construit pour les opérations humanitaires au Kivu.</p>
    </div>
  )
}
