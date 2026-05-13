import { notFound } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const ACCENTS = ['rose', 'blue', 'amber', 'green', 'violet', 'teal'] as const

export default function DevComponentsPage() {
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_DEV_COMPONENTS !== '1') {
    notFound()
  }

  return (
    <div className="t-screen" style={{ paddingTop: 60 }}>
      <header className="t-section-head" style={{ marginTop: 0 }}>
        <div className="t-section-head__left">
          <span className="t-section-head__kicker">DEV · TEACHER</span>
          <h1 className="t-section-head__title">component states</h1>
        </div>
        <Link href="/teacher" className="t-section-head__link">
          Portal del Profesor
          <span className="material-symbols-outlined">arrow_forward</span>
        </Link>
      </header>

      <Section title="Accent swatches" kicker="ACENTOS">
        <div className="t-swatches">
          {ACCENTS.map(a => <span key={a} className={`t-swatch acc-${a}`} aria-label={a} />)}
        </div>
      </Section>

      <Section title="KPIs" kicker="DASHBOARD">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <Kpi label="Cursos activos" value="3" />
          <Kpi label="Estudiantes" value="18" />
          <Kpi accent label="Por revisar" value="4" />
          <Kpi label="Promedio general" value="13.4" />
        </div>
      </Section>

      <Section title="Course cards" kicker="GRID">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 16 }}>
          {ACCENTS.slice(0, 3).map((a, i) => (
            <article key={a} className={`t-course-card acc-${a}`}>
              <div className="t-course-card__head">
                <div className="t-course-card__icon"><span className="material-symbols-outlined">menu_book</span></div>
                <div className="t-course-card__title">
                  <span className="t-course-card__kicker">CURSO · 2026-1</span>
                  <span className="t-course-card__name">Curso {i + 1}</span>
                </div>
              </div>
              <div className="t-course-card__meta">12 estudiantes · 4 créditos</div>
              <div className="t-course-card__code">
                <div>
                  <span className="t-code-block__label">Código</span>
                  <div className="t-course-card__code-value">CRS-2026-{['A1B', 'B2C', 'D3E'][i]}</div>
                </div>
                <button type="button" className="t-btn-line">
                  <span className="material-symbols-outlined">content_copy</span>
                  Copiar
                </button>
              </div>
              <div className="t-stat-strip">
                <div className="t-stat-strip__cell"><span className="t-stat-strip__label">Prom</span><span className="t-stat-strip__value">14.2</span></div>
                <div className="t-stat-strip__cell"><span className="t-stat-strip__label">Aprob</span><span className="t-stat-strip__value">82%</span></div>
                <div className="t-stat-strip__cell"><span className="t-stat-strip__label">Por rev</span><span className="t-stat-strip__value">3</span></div>
              </div>
            </article>
          ))}
        </div>
      </Section>

      <Section title="Filter chips" kicker="GLOBAL">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="t-chip is-active acc-blue"><span className="t-chip__dot" />Todos los cursos</button>
          {ACCENTS.map(a => (
            <button key={a} className={`t-chip acc-${a}`}><span className="t-chip__dot" />Curso {a}</button>
          ))}
        </div>
      </Section>

      <Section title="Buttons" kicker="ACTIONS">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="t-btn-new"><span className="material-symbols-outlined">add</span>Nuevo curso</button>
          <button className="t-btn-line"><span className="material-symbols-outlined">download</span>Exportar CSV</button>
          <button className="t-btn-line" style={{ color: 'var(--danger)' }}><span className="material-symbols-outlined">delete</span></button>
        </div>
      </Section>

      <Section title="Empty state" kicker="EMPTY">
        <div className="t-empty">
          <div className="t-empty__icon"><span className="material-symbols-outlined">campaign</span></div>
          <div className="t-empty__title">Sin anuncios todavía</div>
          <div className="t-empty__sub">Crea tu primer anuncio para que tus alumnos lo vean.</div>
          <button className="t-btn-new"><span className="material-symbols-outlined">add</span>Nuevo anuncio</button>
        </div>
      </Section>

      <Section title="Grade thresholds" kicker="COLOR">
        <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', fontFamily: 'var(--font-mono)' }}>
          <span className="grade-good">17.5 (good)</span>
          <span className="grade-pass">11.0 (pass)</span>
          <span className="grade-risk">9.0 (risk)</span>
          <span className="grade-fail">6.5 (fail)</span>
          <span className="grade-pending">— (pending)</span>
        </div>
      </Section>

      <Section title="Skeleton" kicker="LOADING">
        <div className="t-skeleton" style={{ width: '100%', height: 60 }} />
      </Section>
    </div>
  )
}

function Section({ title, kicker, children }: { title: string; kicker: string; children: React.ReactNode }) {
  return (
    <section style={{ margin: '28px 0' }}>
      <header className="t-section-head" style={{ marginTop: 0 }}>
        <div className="t-section-head__left">
          <span className="t-section-head__kicker">{kicker}</span>
          <h2 className="t-section-head__title">{title}</h2>
        </div>
      </header>
      <div>{children}</div>
    </section>
  )
}

function Kpi({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`t-kpi ${accent ? 't-kpi--accent' : ''}`}>
      <span className="t-kpi__label">{label}</span>
      <span className="t-kpi__value">{value}</span>
    </div>
  )
}
