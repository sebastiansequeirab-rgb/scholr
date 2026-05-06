'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { useTheme } from 'next-themes'
import { useTimeFormat } from '@/hooks/useTimeFormat'

const THEMES: Array<{ key: 'indigo' | 'purple'; primary: string; secondary: string; tertiary: string; desc: string; gradient: string }> = [
  {
    key: 'indigo',
    primary:   '#3b82f6',
    secondary: '#94a3b8',
    tertiary:  '#c084fc',
    desc: 'Skolar Blue',
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 50%, #c084fc 100%)',
  },
  {
    key: 'purple',
    primary:   '#a855f7',
    secondary: '#c4b5fd',
    tertiary:  '#fbbf24',
    desc: 'Skolar Violet',
    gradient: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 50%, #fbbf24 100%)',
  },
]

export default function PersonalizationPage() {
  const { language, changeLanguage } = useTranslation()
  const { theme, setTheme } = useTheme()
  const { use12h, setFormat } = useTimeFormat()
  const [colorTheme, setColorTheme] = useState<'indigo' | 'purple'>('indigo')
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  // Load saved theme from profile
  useEffect(() => {
    const saved = localStorage.getItem('scholr_theme')
    if (saved === 'purple' || saved === 'indigo') setColorTheme(saved)
  }, [])

  useEffect(() => {
    localStorage.setItem('scholr_theme', colorTheme)
    document.documentElement.setAttribute('data-theme', colorTheme)
  }, [colorTheme])

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').update({
        theme:      colorTheme,
        color_mode: theme as 'light' | 'dark' | 'system',
        language,
      }).eq('id', user.id)
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const Section = ({ children, title, icon }: { children: React.ReactNode; title: string; icon: string }) => (
    <section className="card overflow-hidden" style={{ padding: 0 }}>
      <header className="section-head" style={{ padding: '12px 18px', marginBottom: 0 }}>
        <div className="section-head__left">
          <span className="material-symbols-outlined text-[16px]"
            style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>
            {icon}
          </span>
          <span className="section-head__title">{title}</span>
        </div>
      </header>
      <div className="p-5" style={{ borderTop: '1px solid var(--border-subtle)' }}>{children}</div>
    </section>
  )

  return (
    <div className="max-w-lg mx-auto animate-fade-in">

      {/* Page title */}
      <header className="screen-head">
        <div className="screen-head__left">
          <span className="kicker">Skolar · {language === 'es' ? 'Tu look' : 'Your look'}</span>
          <h1 className="screen-head__title">
            <span className="serif">{language === 'es' ? 'personalización' : 'personalization'}</span>
          </h1>
        </div>
      </header>

      <div className="space-y-4">

        {/* ── Color Theme ── */}
        <Section title={language === 'es' ? 'Tema de color' : 'Color theme'} icon="palette">
          <div className="grid grid-cols-2 gap-3">
            {THEMES.map(th => {
              const isActive = colorTheme === th.key
              return (
                <button
                  key={th.key}
                  onClick={() => setColorTheme(th.key)}
                  className="relative overflow-hidden text-left transition-all duration-200 hover:-translate-y-0.5"
                  style={{
                    border: `1px solid ${isActive ? th.primary : 'var(--border-default)'}`,
                    boxShadow: isActive ? `0 4px 18px color-mix(in srgb, ${th.primary} 22%, transparent)` : 'none',
                    borderRadius: 'var(--radius-lg)',
                  }}
                  aria-pressed={isActive}
                >
                  <div className="h-16 w-full relative" style={{ background: th.gradient }}>
                    <div className="absolute bottom-2 left-3 flex gap-1.5">
                      {[th.primary, th.secondary, th.tertiary].map((c, i) => (
                        <div key={i} className="w-4 h-4 rounded-full border border-white/30"
                          style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    {isActive && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: 'rgba(255,255,255,0.92)' }}>
                        <span className="material-symbols-outlined text-[12px]"
                          style={{ color: th.primary, fontVariationSettings: "'wght' 700" }}>check</span>
                      </div>
                    )}
                  </div>
                  <div className="px-3 py-2.5"
                    style={{ backgroundColor: isActive ? `color-mix(in srgb, ${th.primary} 7%, var(--s-low))` : 'var(--s-low)' }}>
                    <span className="kicker block" style={{ color: isActive ? th.primary : 'var(--color-outline)' }}>
                      {isActive ? (language === 'es' ? 'Activo' : 'Active') : (language === 'es' ? 'Seleccionar' : 'Select')}
                    </span>
                    <p className="text-sm font-bold mt-0.5" style={{ color: isActive ? th.primary : 'var(--on-surface)', letterSpacing: '-0.01em' }}>
                      <span className="serif">{th.desc.toLowerCase()}</span>
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </Section>

        {/* ── Color Mode ── */}
        <Section title={language === 'es' ? 'Modo de color' : 'Color mode'} icon="contrast">
          <div className="grid grid-cols-3 gap-2">
            {(['light', 'dark', 'system'] as const).map(m => {
              const isActive = theme === m
              const icons = { light: 'light_mode', dark: 'dark_mode', system: 'brightness_auto' }
              const labels = {
                light: language === 'es' ? 'Claro' : 'Light',
                dark:  language === 'es' ? 'Oscuro' : 'Dark',
                system: language === 'es' ? 'Sistema' : 'System',
              }
              return (
                <button key={m} onClick={() => setTheme(m)}
                  className="flex flex-col items-center gap-2 py-3.5 transition-all duration-150"
                  style={{
                    backgroundColor: isActive ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'var(--s-base)',
                    border: `1px solid ${isActive ? 'var(--color-primary)' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-lg)',
                  }}
                  aria-pressed={isActive}
                >
                  <span className="material-symbols-outlined text-[22px]"
                    style={{
                      color: isActive ? 'var(--color-primary)' : 'var(--color-outline)',
                      fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
                    }}>
                    {icons[m]}
                  </span>
                  <span className="text-xs font-semibold"
                    style={{ color: isActive ? 'var(--color-primary)' : 'var(--color-outline)' }}>
                    {labels[m]}
                  </span>
                </button>
              )
            })}
          </div>
        </Section>

        {/* ── Language ── */}
        <Section title={language === 'es' ? 'Idioma' : 'Language'} icon="language">
          <div className="grid grid-cols-2 gap-2">
            {(['es', 'en'] as const).map(lang => {
              const isActive = language === lang
              return (
                <button key={lang} onClick={() => changeLanguage(lang)}
                  className="flex items-center gap-3 px-4 py-3 transition-all duration-150"
                  style={{
                    backgroundColor: isActive ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'var(--s-base)',
                    border: `1px solid ${isActive ? 'var(--color-primary)' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-lg)',
                  }}
                  aria-pressed={isActive}
                >
                  <span className="text-xl">{lang === 'es' ? '🇻🇪' : '🇺🇸'}</span>
                  <p className="text-sm font-bold" style={{ color: isActive ? 'var(--color-primary)' : 'var(--on-surface)' }}>
                    {lang === 'es' ? 'Español' : 'English'}
                  </p>
                  {isActive && (
                    <span className="ml-auto material-symbols-outlined text-[16px]"
                      style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  )}
                </button>
              )
            })}
          </div>
        </Section>

        {/* ── Time Format ── */}
        <Section title={language === 'es' ? 'Formato de hora' : 'Time format'} icon="schedule">
          <div className="grid grid-cols-2 gap-2">
            {(['24h', '12h'] as const).map(fmt => {
              const isActive = (use12h ? '12h' : '24h') === fmt
              return (
                <button key={fmt} onClick={() => setFormat(fmt)}
                  className="flex flex-col items-center gap-1.5 py-3 transition-all duration-150"
                  style={{
                    backgroundColor: isActive ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'var(--s-base)',
                    border: `1px solid ${isActive ? 'var(--color-primary)' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-lg)',
                  }}
                  aria-pressed={isActive}
                >
                  <span className="mono tabular text-lg font-black leading-none"
                    style={{ color: isActive ? 'var(--color-primary)' : 'var(--on-surface)' }}>
                    {fmt === '24h' ? '13:30' : '1:30'}
                  </span>
                  <span className="text-xs font-semibold"
                    style={{ color: isActive ? 'var(--color-primary)' : 'var(--color-outline)' }}>
                    {fmt === '24h'
                      ? (language === 'es' ? '24 horas' : '24-hour')
                      : (language === 'es' ? '12 horas (AM/PM)' : '12-hour (AM/PM)')}
                  </span>
                </button>
              )
            })}
          </div>
        </Section>

        {/* Save */}
        <button onClick={handleSave} disabled={saving} className="btn btn-primary w-full" style={{ height: 40 }}>
          {saving ? (
            <><span className="material-symbols-outlined animate-pulse-slow">sync</span>
            {language === 'es' ? 'Guardando…' : 'Saving…'}</>
          ) : saved ? (
            <><span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            {language === 'es' ? '¡Guardado!' : 'Saved!'}</>
          ) : (
            <><span className="material-symbols-outlined">save</span>
            {language === 'es' ? 'Guardar' : 'Save'}</>
          )}
        </button>

      </div>
      <div className="pb-6" />
    </div>
  )
}
