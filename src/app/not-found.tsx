export const dynamic = 'force-dynamic'

export default function NotFound() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: '#FDF5E6', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '4rem', fontWeight: 700, color: '#1B4F72', margin: 0 }}>404</h1>
        <p style={{ color: '#5C4033', marginTop: '0.5rem' }}>Page non trouvée</p>
        <a href="/" style={{ display: 'inline-block', marginTop: '1.5rem', padding: '0.75rem 2rem', background: '#1E40AF', color: 'white', borderRadius: '0.5rem', textDecoration: 'none', fontWeight: 600 }}>Retour</a>
      </div>
    </div>
  )
}
