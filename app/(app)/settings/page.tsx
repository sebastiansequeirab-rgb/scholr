'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import type { Profile } from '@/types'

export default function SettingsPage() {
  const { language } = useTranslation()
  const [profile,         setProfile]         = useState<Profile | null>(null)
  const [fullName,        setFullName]        = useState('')
  const [bio,             setBio]             = useState('')
  const [saving,          setSaving]          = useState(false)
  const [saved,           setSaved]           = useState(false)
  const [loading,         setLoading]         = useState(true)
  const [avatarUrl,       setAvatarUrl]       = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [dirty,           setDirty]           = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchProfile = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data) {
      setProfile(data as Profile)
      setFullName(data.full_name || '')
      setBio(data.bio || '')
      setAvatarUrl(data.avatar_url || null)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUploading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setAvatarUploading(false); return }
    const ext  = file.name.split('.').pop()
    const path = `${user.id}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (upErr) { setAvatarUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)
    setAvatarUrl(publicUrl)
    setAvatarUploading(false)
    setDirty(true)
  }

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('profiles').update({
      full_name: fullName,
      bio,
    }).eq('id', user.id)
    setSaving(false)
    setSaved(true)
    setDirty(false)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return (
    <div className="max-w-lg mx-auto space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="skeleton h-32" />)}
    </div>
  )

  return (
    <div className="max-w-lg mx-auto animate-fade-in">

      {/* Page title */}
      <header className="screen-head">
        <div className="screen-head__left">
          <span className="kicker">Skolar · {language === 'es' ? 'Tu perfil' : 'Your profile'}</span>
          <h1 className="screen-head__title">
            <span className="serif">{language === 'es' ? 'cuenta' : 'account'}</span>
          </h1>
        </div>
      </header>

      <div className="space-y-4">

        {/* ── Profile ── */}
        <section className="card overflow-hidden" style={{ padding: 0 }}>
          <header className="section-head" style={{ padding: '12px 18px' }}>
            <div className="section-head__left">
              <span className="material-symbols-outlined text-[16px]"
                style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 0" }}>person</span>
              <span className="section-head__title">
                {language === 'es' ? 'Perfil' : 'Profile'}
              </span>
            </div>
          </header>
          <div className="p-5 pt-4 space-y-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>

            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0">
                <div className="w-16 h-16 overflow-hidden flex items-center justify-center"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-primary) 15%, transparent)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-lg)',
                  }}>
                  {avatarUrl
                    ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                    : <span className="text-xl font-black" style={{ color: 'var(--color-primary)' }}>
                        {fullName ? fullName.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase() : 'U'}
                      </span>
                  }
                </div>
                {avatarUploading && (
                  <div className="absolute inset-0 flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 'var(--radius-lg)' }}>
                    <span className="material-symbols-outlined text-white text-[18px] animate-spin" style={{ animationDuration: '1s' }}>sync</span>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <span className="kicker block">
                  {language === 'es' ? 'Foto de perfil' : 'Profile photo'}
                </span>
                <p className="text-xs mt-1 mb-2" style={{ color: 'var(--color-outline)' }}>
                  JPG · PNG · WebP · máx 5 MB
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="btn btn-secondary text-xs"
                >
                  <span className="material-symbols-outlined">upload</span>
                  {language === 'es' ? 'Cambiar foto' : 'Change photo'}
                </button>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                  className="hidden" onChange={handleAvatarChange} />
              </div>
            </div>

            {/* Full name — serif italic per mock */}
            <div className="settings-field">
              <label htmlFor="settingsName" className="settings-field__label">
                {language === 'es' ? 'NOMBRE COMPLETO' : 'FULL NAME'}
              </label>
              <input
                id="settingsName"
                className="settings-field__name"
                value={fullName}
                placeholder={language === 'es' ? 'Tu nombre' : 'Your name'}
                onChange={(e) => { setFullName(e.target.value); setDirty(true) }}
              />
            </div>

            {/* Bio */}
            <div>
              <label htmlFor="settingsBio" className="label">
                {language === 'es' ? 'Sobre mí' : 'About me'}
              </label>
              <textarea id="settingsBio" className="input resize-none h-20 text-sm" value={bio}
                onChange={(e) => { setBio(e.target.value); setDirty(true) }}
                placeholder={language === 'es' ? 'Escribe algo sobre ti…' : 'Write something about yourself…'} />
            </div>
          </div>
        </section>

        {/* ── Plan ── */}
        <section className="card overflow-hidden" style={{ padding: 0 }}>
          <header className="section-head" style={{ padding: '12px 18px' }}>
            <div className="section-head__left">
              <span className="material-symbols-outlined text-[16px]"
                style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 0" }}>workspace_premium</span>
              <span className="section-head__title">
                {language === 'es' ? 'Plan' : 'Plan'}
              </span>
            </div>
          </header>
          <div className="p-5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: profile?.is_premium ? 'color-mix(in srgb, var(--warning) 15%, transparent)' : 'var(--s-high)',
                    borderRadius: 'var(--radius-lg)',
                  }}>
                  <span className="material-symbols-outlined text-[18px]"
                    style={{ color: profile?.is_premium ? 'var(--warning)' : 'var(--color-outline)', fontVariationSettings: "'FILL' 1" }}>
                    {profile?.is_premium ? 'star' : 'workspace_premium'}
                  </span>
                </div>
                <div>
                  <span className="kicker block">
                    {profile?.is_premium ? 'Premium' : 'Free'}
                  </span>
                  <p className="text-sm font-bold" style={{ color: 'var(--on-surface)', letterSpacing: '-0.01em' }}>
                    <span className="serif">Skolar </span>{profile?.is_premium ? 'premium' : 'free'}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-outline)' }}>
                    {profile?.is_premium
                      ? (language === 'es' ? 'Acceso completo activo' : 'Full access active')
                      : (language === 'es' ? 'Plan gratuito' : 'Free plan')}
                  </p>
                </div>
              </div>
              {!profile?.is_premium && (
                <button className="settings-upgrade flex-shrink-0">
                  <span className="material-symbols-outlined">upgrade</span>
                  Upgrade
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Save button — only shown when dirty */}
        {dirty && (
          <button onClick={handleSave} disabled={saving} className="btn btn-primary w-full animate-slide-up" style={{ height: 40 }}>
            {saving ? (
              <>
                <span className="material-symbols-outlined animate-pulse-slow">sync</span>
                {language === 'es' ? 'Guardando…' : 'Saving…'}
              </>
            ) : saved ? (
              <>
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                {language === 'es' ? '¡Guardado!' : 'Saved!'}
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">save</span>
                {language === 'es' ? 'Guardar cambios' : 'Save changes'}
              </>
            )}
          </button>
        )}

      </div>
      <div className="pb-6" />
    </div>
  )
}
