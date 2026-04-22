'use client'

import { useTranslation } from '@/hooks/useTranslation'

export default function AISettingsPage() {
  const { language } = useTranslation()

  return (
    <div className="max-w-lg mx-auto animate-fade-in">

      {/* Page title */}
      <div className="mb-6">
        <p className="mono text-[10px] tracking-[0.18em] uppercase mb-1" style={{ color: 'var(--color-primary)' }}>
          Skolar
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--on-surface)' }}>
          {language === 'es' ? 'Configuración de IA' : 'AI Settings'}
        </h1>
      </div>

      {/* Placeholder card */}
      <section className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center gap-2.5 px-5 py-3.5"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <span className="material-symbols-outlined text-[16px]"
            style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
          <h2 className="text-sm font-bold tracking-tight" style={{ color: 'var(--on-surface)' }}>
            {language === 'es' ? 'Asistente IA' : 'AI Assistant'}
          </h2>
        </div>
        <div className="p-5 space-y-4">

          {/* Info */}
          <div className="flex items-start gap-3 p-3 rounded-xl"
            style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--color-primary) 15%, transparent)' }}>
            <span className="material-symbols-outlined text-[18px] flex-shrink-0 mt-0.5"
              style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>info</span>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--on-surface)' }}>
              {language === 'es'
                ? 'La IA de Skolar utiliza el modelo llama-3.3-70b y responde en el idioma configurado en Personalización. Las conversaciones por materia acumulan contexto automáticamente.'
                : "Skolar's AI uses the llama-3.3-70b model and responds in the language set in Personalization. Subject conversations accumulate context automatically."}
            </p>
          </div>

          {/* Coming soon */}
          <div className="py-6 flex flex-col items-center gap-2 text-center">
            <span className="material-symbols-outlined text-[32px]"
              style={{ color: 'var(--color-outline)', fontVariationSettings: "'FILL' 1" }}>auto_fix_high</span>
            <p className="text-sm font-semibold" style={{ color: 'var(--on-surface)' }}>
              {language === 'es' ? 'Más configuraciones próximamente' : 'More settings coming soon'}
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
