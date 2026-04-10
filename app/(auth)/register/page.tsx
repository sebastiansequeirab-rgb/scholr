'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'

export default function RegisterPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const validate = () => {
    if (!fullName.trim()) return t('auth.errors.required')
    if (!email) return t('auth.errors.required')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return t('auth.errors.invalidEmail')
    if (password.length < 8) return t('auth.errors.passwordMin')
    if (password !== confirmPassword) return t('auth.errors.passwordMismatch')
    return ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setLoading(true)
    setError('')

    const supabase = createClient()
    const browserLang = navigator.language.startsWith('es') ? 'es' : 'en'

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          language: browserLang,
        },
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    setSent(true)
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" data-theme="indigo">
        <div className="w-full max-w-sm text-center">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 rounded-full blur-[40px] opacity-20"
              style={{ backgroundColor: 'var(--color-primary)' }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
              style={{ backgroundColor: 'var(--s-base)', border: '1px solid var(--border-default)' }}>
              <span className="material-symbols-outlined text-3xl" style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>
                mark_email_unread
              </span>
            </div>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight mb-2" style={{ color: 'var(--on-surface)' }}>
            Revisa tu correo
          </h1>
          <p className="text-sm mb-2" style={{ color: 'var(--on-surface-variant)' }}>
            Enviamos un enlace de confirmación a
          </p>
          <p className="text-sm font-semibold mb-6" style={{ color: 'var(--color-primary)' }}>
            {email}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-outline)' }}>
            Abre el correo y haz click en el enlace para activar tu cuenta.
          </p>
          <p className="text-xs mt-4" style={{ color: 'var(--color-outline)' }}>
            ¿Ya confirmaste?{' '}
            <Link href="/login" className="font-semibold hover:underline" style={{ color: 'var(--color-primary)' }}>
              Iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" data-theme="indigo">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-primary)' }}>
            Scholr
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
            {t('auth.register')}
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="label">{t('auth.fullName')}</label>
              <input
                id="fullName"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input"
                aria-required="true"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="label">{t('auth.email')}</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="tu@correo.com"
                aria-required="true"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="label">{t('auth.password')}</label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                aria-required="true"
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="label">{t('auth.confirmPassword')}</label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input"
                aria-required="true"
              />
            </div>

            {/* Error */}
            {error && (
              <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg p-2.5" role="alert">
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? t('common.loading') : t('auth.register')}
            </button>
          </form>

          {/* Link to login */}
          <p className="text-center text-sm mt-4" style={{ color: 'var(--color-muted)' }}>
            {t('auth.haveAccount')}{' '}
            <Link href="/login" className="font-semibold hover:underline" style={{ color: 'var(--color-primary)' }}>
              {t('auth.signIn')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
