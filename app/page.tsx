'use client'

import { useTranslation } from '@/hooks/useTranslation'
import Link from 'next/link'

export default function LandingPage() {
  const { t } = useTranslation()

  const features = [
    { key: 'calendar', icon: '📅' },
    { key: 'tasks', icon: '✅' },
    { key: 'notes', icon: '📝' },
    { key: 'exams', icon: '📋' },
  ] as const

  return (
    <div className="min-h-screen" data-theme="indigo">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b" style={{ backgroundColor: 'color-mix(in srgb, var(--background) 80%, transparent)', borderColor: 'var(--color-border)' }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>Scholr</span>
          <div className="flex items-center gap-3">
            <Link href="/login" className="btn-ghost hidden sm:inline-flex">{t('landing.hero.login')}</Link>
            <Link href="/register" className="btn-primary">{t('landing.hero.cta')}</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6 text-center relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl" style={{ backgroundColor: 'var(--color-primary)' }} />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl" style={{ backgroundColor: 'var(--color-secondary)' }} />
        </div>

        <div className="relative max-w-3xl mx-auto">
          <span className="badge mb-6 inline-flex" style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-primary)' }}>
            ✨ La herramienta que todo estudiante necesita
          </span>
          <h1 className="text-4xl sm:text-6xl font-bold leading-tight mb-6">
            {t('landing.hero.title')}
          </h1>
          <p className="text-lg sm:text-xl mb-10 max-w-2xl mx-auto" style={{ color: 'var(--color-muted)' }}>
            {t('landing.hero.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register" className="btn-primary text-base px-8 py-3">
              🚀 {t('landing.hero.cta')}
            </Link>
            <Link href="/login" className="btn-secondary text-base px-8 py-3">
              {t('landing.hero.login')}
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 mt-16">
            {[
              { num: '10k+', label: 'Estudiantes' },
              { num: '50k+', label: 'Tareas completadas' },
              { num: '99%', label: 'Satisfacción' },
            ].map(({ num, label }) => (
              <div key={label}>
                <p className="text-3xl font-bold" style={{ color: 'var(--color-primary)' }}>{num}</p>
                <p className="text-sm" style={{ color: 'var(--color-muted)' }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6" style={{ backgroundColor: 'var(--color-surface)' }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">{t('landing.features.title')}</h2>
          <p className="text-center mb-14" style={{ color: 'var(--color-muted)' }}>
            Todo lo que necesitas en un solo lugar
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map(({ key, icon }) => (
              <div key={key} className="card text-center hover:shadow-md transition-all hover:-translate-y-1">
                <div className="text-4xl mb-4">{icon}</div>
                <h3 className="font-bold mb-2">{t(`landing.features.${key}.title`)}</h3>
                <p className="text-sm" style={{ color: 'var(--color-muted)' }}>{t(`landing.features.${key}.desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-14">{t('landing.pricing.title')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Free */}
            <div className="card">
              <h3 className="text-xl font-bold mb-1">{t('landing.pricing.free.name')}</h3>
              <p className="text-3xl font-bold mb-6" style={{ color: 'var(--color-primary)' }}>
                {t('landing.pricing.free.price')}
              </p>
              <ul className="space-y-2 mb-6">
                {(t('landing.pricing.free.features') as unknown as string[]).map?.((f: string) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <span style={{ color: 'var(--color-primary)' }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link href="/register" className="btn-secondary w-full text-center block">
                {t('landing.pricing.cta')}
              </Link>
            </div>

            {/* Premium */}
            <div className="card relative overflow-hidden" style={{ border: `2px solid var(--color-primary)` }}>
              <span className="absolute top-4 right-4 badge text-white text-xs" style={{ backgroundColor: 'var(--color-primary)' }}>
                ⭐ {t('landing.pricing.popular')}
              </span>
              <h3 className="text-xl font-bold mb-1">{t('landing.pricing.premium.name')}</h3>
              <p className="text-3xl font-bold mb-6" style={{ color: 'var(--color-primary)' }}>
                {t('landing.pricing.premium.price')}
              </p>
              <ul className="space-y-2 mb-6">
                {(t('landing.pricing.premium.features') as unknown as string[]).map?.((f: string) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <span style={{ color: 'var(--color-primary)' }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link href="/register" className="btn-primary w-full text-center block">
                {t('landing.pricing.cta')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t text-center" style={{ borderColor: 'var(--color-border)' }}>
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
          © {new Date().getFullYear()} Scholr. {t('landing.footer.rights')}
        </p>
      </footer>
    </div>
  )
}
