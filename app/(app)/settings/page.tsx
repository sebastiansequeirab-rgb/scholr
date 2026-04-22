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
      <div className="mb-6">
        <p className="mono text-[10px] tracking-[0.18em] uppercase mb-1" style={{ color: 'var(--color-primary)' }}>
          Skolar
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--on-surface)' }}>
          {language === 'es' ? 'Cuenta' : 'Account'}
        </h1>
      </div>

      <div className="space-y-4">

        {/* ── Profile ── */}
        <section className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-2.5 px-5 py-3.5"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <span className="material-symbols-outlined text-[16px]"
              style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>person</span>
            <h2 className="text-sm font-bold tracking-tight" style={{ color: 'var(--on-surface)' }}>
              {language === 'es' ? 'Perfil' : 'Profile'}
            </h2>
          </div>
          <div className="p-5 space-y-4">

            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0">
                <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', border: '2px solid var(--border-default)' }}>
                  {avatarUrl
                    ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                    : <span className="text-xl font-black" style={{ color: 'var(--color-primary)' }}>
                        {fullName ? fullName.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase() : 'U'}
                      </span>
                  }
                </div>
                {avatarUploading && (
                  <div className="absolute inset-0 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <span className="material-symbols-outlined text-white text-[18px] animate-spin" style={{ animationDuration: '1s' }}>sync</span>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--on-surface)' }}>
                  {language === 'es' ? 'Foto de perfil' : 'Profile photo'}
                </p>
                <p className="text-xs mb-2" style={{ color: 'var(--color-outline)' }}>
                  {language === 'es' ? 'JPG, PNG o WebP · máx. 5 MB' : 'JPG, PNG or WebP · max 5 MB'}
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[13px]">upload</span>
                  {language === 'es' ? 'Cambiar foto' : 'Change photo'}
                </button>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                  className="hidden" onChange={handleAvatarChange} />
              </div>
            </div>

            {/* Full name */}
            <div>
              <label htmlFor="settingsName" className="label">
                {language === 'es' ? 'Nombre completo' : 'Full name'}
              </label>
              <input id="settingsName" className="input" value={fullName}
                onChange={(e) => { setFullName(e.target.value); setDirty(true) }} />
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
        <section className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-2.5 px-5 py-3.5"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <span className="material-symbols-outlined text-[16px]"
              style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
            <h2 className="text-sm font-bold tracking-tight" style={{ color: 'var(--on-surface)' }}>
              {language === 'es' ? 'Plan' : 'Plan'}
            </h2>
          </div>
          <div className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: profile?.is_premium ? 'color-mix(in srgb, var(--warning) 15%, transparent)' : 'var(--s-high)' }}>
                  <span className="material-symbols-outlined text-[18px]"
                    style={{ color: profile?.is_premium ? 'var(--warning)' : 'var(--color-outline)', fontVariationSettings: "'FILL' 1" }}>
                    {profile?.is_premium ? 'star' : 'workspace_premium'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: 'var(--on-surface)' }}>
                    {profile?.is_premium ? 'Skolar Premium' : 'Skolar Free'}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-outline)' }}>
                    {profile?.is_premium
                      ? (language === 'es' ? 'Acceso completo activo' : 'Full access active')
                      : (language === 'es' ? 'Plan gratuito' : 'Free plan')}
                  </p>
                </div>
              </div>
              {!profile?.is_premium && (
                <button
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs transition-all active:scale-95 hover:scale-105 flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: 'white' }}
                >
                  <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>upgrade</span>
                  Upgrade
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Save button — only shown when dirty */}
        {dirty && (
          <button onClick={handleSave} disabled={saving} className="btn-primary w-full py-3 text-base animate-slide-up">
            {saving ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-pulse-slow">sync</span>
                {language === 'es' ? 'Guardando…' : 'Saving…'}
              </>
            ) : saved ? (
              <>
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                {language === 'es' ? '¡Guardado!' : 'Saved!'}
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">save</span>
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
