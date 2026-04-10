'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { useTheme } from 'next-themes'
import { useTimeFormat } from '@/hooks/useTimeFormat'
import type { Profile } from '@/types'

const THEMES: Array<{ key: 'indigo' | 'purple' | 'green'; labelKey: string; primary: string; secondary: string }> = [
  { key: 'indigo', labelKey: 'settings.themes.indigo', primary: '#185FA5', secondary: '#1D9E75' },
  { key: 'purple', labelKey: 'settings.themes.purple', primary: '#534AB7', secondary: '#EF9F27' },
  { key: 'green', labelKey: 'settings.themes.green', primary: '#0F6E56', secondary: '#3B6D11' },
]

export default function SettingsPage() {
  const { t, language, changeLanguage } = useTranslation()
  const { theme, setTheme } = useTheme()
  const { use12h, setFormat } = useTimeFormat()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [fullName, setFullName] = useState('')
  const [colorTheme, setColorTheme] = useState<'indigo' | 'purple' | 'green'>('indigo')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data) {
      setProfile(data as Profile)
      setFullName(data.full_name || '')
      setColorTheme(data.theme || 'indigo')
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  // Apply and persist color theme immediately on change
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
      full_name: fullName,
      theme: colorTheme,
      color_mode: theme as 'light' | 'dark' | 'system',
      language,
    }).eq('id', user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <div className="skeleton h-64 max-w-xl mx-auto" />

  return (
    <div className="max-w-xl mx-auto animate-fade-in space-y-6">
      <h1 className="text-2xl font-bold">{t('settings.title')}</h1>

      {/* Profile */}
      <section className="card space-y-4">
        <h2 className="font-semibold text-base">{t('settings.profile')}</h2>
        <div>
          <label htmlFor="settingsName" className="label">{t('settings.fullName')}</label>
          <input
            id="settingsName"
            className="input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        {/* Plan */}
        <div className="flex items-center justify-between py-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <p className="text-sm font-medium">{t('settings.plan')}</p>
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
              {profile?.is_premium ? '⭐ ' + t('settings.premium') : t('settings.free')}
            </p>
          </div>
          {!profile?.is_premium && (
            <button className="btn-secondary text-xs py-1.5 px-3">
              ⬆️ {t('settings.upgrade')}
            </button>
          )}
        </div>
      </section>

      {/* Color Theme */}
      <section className="card space-y-4">
        <h2 className="font-semibold text-base">{t('settings.theme')}</h2>
        <div className="grid grid-cols-3 gap-3">
          {THEMES.map(th => (
            <button
              key={th.key}
              onClick={() => setColorTheme(th.key)}
              className={`rounded-2xl p-4 text-left transition-all border-2 ${colorTheme === th.key ? '' : 'border-transparent'}`}
              style={{
                backgroundColor: 'var(--color-surface)',
                borderColor: colorTheme === th.key ? th.primary : 'transparent',
              }}
              aria-pressed={colorTheme === th.key}
            >
              {/* Preview swatch */}
              <div className="flex gap-1 mb-2">
                <div className="w-5 h-5 rounded-full" style={{ backgroundColor: th.primary }} />
                <div className="w-5 h-5 rounded-full" style={{ backgroundColor: th.secondary }} />
              </div>
              <p className="text-xs font-medium">{t(th.labelKey)}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Color mode */}
      <section className="card space-y-3">
        <h2 className="font-semibold text-base">{t('settings.colorMode')}</h2>
        <div className="flex gap-2">
          {(['light', 'dark', 'system'] as const).map(m => (
            <button
              key={m}
              onClick={() => setTheme(m)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${theme === m ? 'text-white' : ''}`}
              style={{
                backgroundColor: theme === m ? 'var(--color-primary)' : 'var(--color-surface)',
                borderColor: theme === m ? 'var(--color-primary)' : 'var(--color-border)',
                color: theme === m ? 'white' : 'var(--color-muted)',
              }}
              aria-pressed={theme === m}
            >
              {m === 'light' ? `☀️ ${t('settings.light')}` : m === 'dark' ? `🌙 ${t('settings.dark')}` : `⚙️ ${t('settings.system')}`}
            </button>
          ))}
        </div>
      </section>

      {/* Time format */}
      <section className="card space-y-3">
        <h2 className="font-semibold text-base">{language === 'es' ? 'Formato de hora' : 'Time format'}</h2>
        <div className="flex gap-2">
          {(['24h', '12h'] as const).map(fmt => (
            <button
              key={fmt}
              onClick={() => setFormat(fmt)}
              className="flex-1 py-2 rounded-xl text-sm font-medium border transition-all"
              style={{
                backgroundColor: (use12h ? '12h' : '24h') === fmt ? 'var(--color-primary)' : 'var(--color-surface)',
                borderColor:     (use12h ? '12h' : '24h') === fmt ? 'var(--color-primary)' : 'var(--color-border)',
                color:           (use12h ? '12h' : '24h') === fmt ? 'white' : 'var(--color-muted)',
              }}
              aria-pressed={(use12h ? '12h' : '24h') === fmt}
            >
              {fmt === '24h'
                ? (language === 'es' ? '⏰ 24h — 13:30' : '⏰ 24h — 1:30 PM')
                : (language === 'es' ? '🕑 12h — 1:30 pm' : '🕑 12h — 1:30 pm')}
            </button>
          ))}
        </div>
      </section>

      {/* Language */}
      <section className="card space-y-3">
        <h2 className="font-semibold text-base">{t('settings.language')}</h2>
        <div className="flex gap-2">
          {(['es', 'en'] as const).map(lang => (
            <button
              key={lang}
              onClick={() => changeLanguage(lang)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all`}
              style={{
                backgroundColor: language === lang ? 'var(--color-primary)' : 'var(--color-surface)',
                borderColor: language === lang ? 'var(--color-primary)' : 'var(--color-border)',
                color: language === lang ? 'white' : 'var(--color-muted)',
              }}
              aria-pressed={language === lang}
            >
              {lang === 'es' ? '🇪🇸 ' + t('settings.spanish') : '🇬🇧 ' + t('settings.english')}
            </button>
          ))}
        </div>
      </section>

      {/* Save */}
      <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
        {saving ? t('common.loading') : saved ? '✓ ¡Guardado!' : t('settings.save')}
      </button>
    </div>
  )
}
