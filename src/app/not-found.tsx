export default function NotFound() {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      fontFamily: "system-ui, sans-serif",
      color: "#374151",
    }}>
      <h1 style={{ fontSize: "3rem", fontWeight: 700, margin: 0 }}>404</h1>
      <p style={{ fontSize: "1.125rem", margin: "0.5rem 0 1.5rem" }}>Page non trouvée</p>
      <a href="/" style={{
        color: "#2563eb",
        textDecoration: "underline",
        fontSize: "0.875rem",
      }}>Retour</a>
    </div>
  )
}
