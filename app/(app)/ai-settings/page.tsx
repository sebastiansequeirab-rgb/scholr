'use client'

import { useTranslation } from '@/hooks/useTranslation'

export default function AISettingsPage() {
  const { language } = useTranslation()

  return (
    <div className="max-w-lg mx-auto reveal-stagger">

      {/* Page title */}
      <header className="screen-head">
        <div className="screen-head__left">
          <span className="kicker">Skolar IA · {language === 'es' ? 'Configuración' : 'Settings'}</span>
          <h1 className="screen-head__title">
            <span className="serif">{language === 'es' ? 'tu copiloto' : 'your copilot'}</span>
          </h1>
        </div>
      </header>

      {/* Placeholder card */}
      <section className="card overflow-hidden" style={{ padding: 0 }}>
        <header className="section-head" style={{ padding: '12px 18px', marginBottom: 0 }}>
          <div className="section-head__left">
            <span className="material-symbols-outlined text-[16px]"
              style={{ color: 'var(--color-tertiary)', fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            <span className="section-head__title">
              {language === 'es' ? 'Asistente IA' : 'AI Assistant'}
            </span>
          </div>
          <span className="badge badge--ai">
            llama-3.3-70b
          </span>
        </header>
        <div className="p-5 space-y-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>

          {/* Info */}
          <div className="flex items-start gap-3 p-3"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-tertiary) 6%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-tertiary) 18%, transparent)',
              borderRadius: 'var(--radius)',
            }}>
            <span className="material-symbols-outlined text-[16px] flex-shrink-0 mt-0.5"
              style={{ color: 'var(--color-tertiary)', fontVariationSettings: "'FILL' 1" }}>info</span>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--on-surface)' }}>
              {language === 'es'
                ? 'La IA de Skolar utiliza el modelo llama-3.3-70b y responde en el idioma configurado en Personalización. Las conversaciones por materia acumulan contexto automáticamente.'
                : "Skolar's AI uses the llama-3.3-70b model and responds in the language set in Personalization. Subject conversations accumulate context automatically."}
            </p>
          </div>

          {/* Coming soon */}
          <div className="py-8 flex flex-col items-center gap-2 text-center">
            <span className="material-symbols-outlined text-[28px] mb-1"
              style={{ color: 'var(--color-outline)', fontVariationSettings: "'FILL' 1" }}>auto_fix_high</span>
            <span className="kicker">
              {language === 'es' ? 'En camino' : 'Coming soon'}
            </span>
            <p className="text-base font-bold" style={{ color: 'var(--on-surface)', letterSpacing: '-0.01em' }}>
              <span className="serif">
                {language === 'es' ? 'más configuraciones' : 'more settings'}
              </span>
            </p>
            <p className="text-xs" style={{ color: 'var(--color-outline)' }}>
              {language === 'es'
                ? 'Personalización avanzada del asistente IA en camino.'
                : 'Advanced AI assistant customization on the way.'}
            </p>
          </div>

        </div>
      </section>

      <div className="pb-6" />
    </div>
  )
}
