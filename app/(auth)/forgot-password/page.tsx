'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'

export default function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t('auth.errors.invalidEmail'))
      return
    }

    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)
    if (resetError) {
      setError(resetError.message)
    } else {
      setSuccess(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" data-theme="indigo">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-primary)' }}>
            Scholr
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
            {t('auth.resetPassword')}
          </p>
        </div>

        <div className="card">
          {success ? (
            <div className="text-center py-4 space-y-3">
              <div className="text-4xl">📬</div>
              <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                Te enviamos un enlace a <strong>{email}</strong> para restablecer tu contraseña.
              </p>
              <Link href="/login" className="btn-primary inline-flex mt-2">
                {t('auth.backToLogin')}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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

              {error && (
                <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg p-2.5" role="alert">
                  {error}
                </p>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? t('common.loading') : t('auth.sendResetLink')}
              </button>

              <div className="text-center">
                <Link href="/login" className="text-sm hover:underline" style={{ color: 'var(--color-muted)' }}>
                  {t('auth.backToLogin')}
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
