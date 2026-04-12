'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { useTheme } from 'next-themes'
import { useTimeFormat } from '@/hooks/useTimeFormat'
import type { Profile } from '@/types'

const THEMES: Array<{ key: 'indigo' | 'purple'; labelKey: string; primary: string; secondary: string; tertiary: string; desc: string; gradient: string }> = [
  {
    key: 'indigo',
    labelKey: 'settings.themes.indigo',
    primary:   '#3b82f6',
    secondary: '#94a3b8',
    tertiary:  '#c084fc',
    desc: 'Scholar Blue',
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 50%, #c084fc 100%)',
  },
  {
    key: 'purple',
    labelKey: 'settings.themes.purple',
    primary:   '#a855f7',
    secondary: '#c4b5fd',
    tertiary:  '#fbbf24',
    desc: 'Scholar Violet',
    gradient: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 50%, #fbbf24 100%)',
  },
]

export default function SettingsPage() {
  const { t, language, changeLanguage } = useTranslation()
  const { theme, setTheme } = useTheme()
  const { use12h, setFormat } = useTimeFormat()
  const [profile,    setProfile]    = useState<Profile | null>(null)
  const [fullName,   setFullName]   = useState('')
  const [colorTheme, setColorTheme] = useState<'indigo' | 'purple'>('indigo')
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [loading,    setLoading]    = useState(true)

  const fetchProfile = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data) {
      setProfile(data as Profile)
      setFullName(data.full_name || '')
      const savedTheme = data.theme as string
      setColorTheme((savedTheme === 'purple' ? 'purple' : 'indigo'))
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  useEffect(() => {
    localStorage.setItem('scholr_theme', colorTheme)
    document.documentElement.setAttribute('data-theme', colorTheme)
  }, [colorTheme])

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('profiles').update({
      full_name:  fullName,
      theme:      colorTheme,
      color_mode: theme as 'light' | 'dark' | 'system',
      language,
    }).eq('id', user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return (
    <div className="max-w-lg mx-auto space-y-4">
      {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-32" />)}
    </div>
  )

  const Section = ({ children, title, icon }: { children: React.ReactNode; title: string; icon: string }) => (
    <section className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex items-center gap-2.5 px-5 py-3.5"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <span className="material-symbols-outlined text-[16px]"
          style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>
          {icon}
        </span>
        <h2 className="text-sm font-bold tracking-tight" style={{ color: 'var(--on-surface)' }}>{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  )

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">

      {/* Page title */}
      <div className="mb-6">
        <p className="mono text-[10px] tracking-[0.18em] uppercase mb-1" style={{ color: 'var(--color-primary)' }}>
          Scholr
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--on-surface)' }}>
          {t('settings.title')}
        </h1>
      </div>

      {/* ── Desktop 2-column grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">

        {/* Left column */}
        <div className="space-y-4">

          {/* ── Profile ── */}
          <Section title={t('settings.profile')} icon="person">
            <div className="space-y-4">
              <div>
                <label htmlFor="settingsName" className="label">{t('settings.fullName')}</label>
                <input
                  id="settingsName"
                  className="input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              {/* Plan row */}
              <div className="flex items-center justify-between py-3 px-4 rounded-xl"
                style={{ backgroundColor: 'var(--s-base)', border: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: profile?.is_premium ? 'color-mix(in srgb, var(--warning) 15%, transparent)' : 'var(--s-high)' }}>
                    <span className="material-symbols-outlined text-[16px]"
                      style={{ color: profile?.is_premium ? 'var(--warning)' : 'var(--color-outline)', fontVariationSettings: "'FILL' 1" }}>
                      {profile?.is_premium ? 'star' : 'workspace_premium'}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--on-surface)' }}>{t('settings.plan')}</p>
                    <p className="text-xs" style={{ color: 'var(--color-outline)' }}>
                      {profile?.is_premium ? t('settings.premium') : t('settings.free')}
                    </p>
                  </div>
                </div>
                {!profile?.is_premium && (
                  <button className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-primary)' }}>upgrade</span>
                    {t('settings.upgrade')}
                  </button>
                )}
              </div>
            </div>
          </Section>

          {/* ── Color Mode ── */}
          <Section title={t('settings.colorMode')} icon="contrast">
            <div className="grid grid-cols-3 gap-2">
              {(['light', 'dark', 'system'] as const).map(m => {
                const isActive = theme === m
                const icons = { light: 'light_mode', dark: 'dark_mode', system: 'brightness_auto' }
                return (
                  <button
                    key={m}
                    onClick={() => setTheme(m)}
                    className="flex flex-col items-center gap-2 py-3.5 rounded-2xl transition-all duration-150"
                    style={{
                      backgroundColor: isActive
                        ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
                        : 'var(--s-base)',
                      border: `2px solid ${isActive ? 'var(--color-primary)' : 'transparent'}`,
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
                      {m === 'light' ? t('settings.light') : m === 'dark' ? t('settings.dark') : t('settings.system')}
                    </span>
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
                  <button
                    key={fmt}
                    onClick={() => setFormat(fmt)}
                    className="flex flex-col items-center gap-1.5 py-3.5 rounded-2xl transition-all duration-150"
                    style={{
                      backgroundColor: isActive
                        ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
                        : 'var(--s-base)',
                      border: `2px solid ${isActive ? 'var(--color-primary)' : 'transparent'}`,
                    }}
                    aria-pressed={isActive}
                  >
                    <span className="mono text-lg font-black leading-none"
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

          {/* ── Language ── */}
          <Section title={t('settings.language')} icon="language">
            <div className="grid grid-cols-2 gap-2">
              {(['es', 'en'] as const).map(lang => {
                const isActive = language === lang
                return (
                  <button
                    key={lang}
                    onClick={() => changeLanguage(lang)}
                    className="flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-150"
                    style={{
                      backgroundColor: isActive
                        ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
                        : 'var(--s-base)',
                      border: `2px solid ${isActive ? 'var(--color-primary)' : 'transparent'}`,
                    }}
                    aria-pressed={isActive}
                  >
                    <span className="text-xl">{lang === 'es' ? '🇪🇸' : '🇬🇧'}</span>
                    <div className="text-left">
                      <p className="text-sm font-bold leading-tight"
                        style={{ color: isActive ? 'var(--color-primary)' : 'var(--on-surface)' }}>
                        {lang === 'es' ? 'Español' : 'English'}
                      </p>
                      <p className="text-[10px]" style={{ color: 'var(--color-outline)' }}>
                        {lang === 'es' ? 'Spanish' : 'British English'}
                      </p>
                    </div>
                    {isActive && (
                      <span className="ml-auto material-symbols-outlined text-[16px]"
                        style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>
                        check_circle
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </Section>

        </div>

        {/* Right column */}
        <div className="space-y-4">

          {/* ── Color Theme ── */}
          <Section title={t('settings.theme')} icon="palette">
            <div className="grid grid-cols-2 gap-3">
              {THEMES.map(th => {
                const isActive = colorTheme === th.key
                return (
                  <button
                    key={th.key}
                    onClick={() => setColorTheme(th.key)}
                    className="relative rounded-2xl overflow-hidden text-left transition-all duration-200 hover:-translate-y-0.5"
                    style={{
                      border: `2px solid ${isActive ? th.primary : 'var(--border-default)'}`,
                      boxShadow: isActive ? `0 4px 24px ${th.primary}30` : 'none',
                    }}
                    aria-pressed={isActive}
                  >
                    {/* Gradient preview bar */}
                    <div className="h-16 w-full relative"
                      style={{ background: th.gradient }}>
                      {/* Color swatches overlay */}
                      <div className="absolute bottom-2 left-3 flex gap-1.5">
                        <div className="w-5 h-5 rounded-full border-2 border-white/30 shadow-sm"
                          style={{ backgroundColor: th.primary }} />
                        <div className="w-5 h-5 rounded-full border-2 border-white/30 shadow-sm"
                          style={{ backgroundColor: th.secondary }} />
                        <div className="w-5 h-5 rounded-full border-2 border-white/30 shadow-sm"
                          style={{ backgroundColor: th.tertiary }} />
                      </div>
                      {isActive && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: 'rgba(255,255,255,0.9)' }}>
                          <span className="material-symbols-outlined text-[12px] font-black"
                            style={{ color: th.primary, fontVariationSettings: "'wght' 700" }}>check</span>
                        </div>
                      )}
                    </div>
                    {/* Label */}
                    <div className="p-3"
                      style={{ backgroundColor: isActive ? `color-mix(in srgb, ${th.primary} 6%, var(--s-low))` : 'var(--s-low)' }}>
                      <p className="text-sm font-bold leading-tight" style={{ color: isActive ? th.primary : 'var(--on-surface)' }}>
                        {th.desc}
                      </p>
                      <p className="text-[10px] mt-0.5 mono tracking-wide" style={{ color: 'var(--color-outline)' }}>
                        {isActive ? (language === 'es' ? 'Tema activo' : 'Active theme') : (language === 'es' ? 'Seleccionar' : 'Select')}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </Section>

          {/* Save button (right column, sticky-ish) */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary w-full py-3 text-base"
          >
            {saving ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-pulse-slow">sync</span>
                {t('common.loading')}
              </>
            ) : saved ? (
              <>
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                {language === 'es' ? '¡Guardado!' : 'Saved!'}
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">save</span>
                {t('settings.save')}
              </>
            )}
          </button>

        </div>
      </div>

      <div className="pb-4" />
    </div>
  )
}
