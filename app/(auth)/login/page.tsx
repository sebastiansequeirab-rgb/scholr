'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'

export default function LoginPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const validate = () => {
    if (!email) return t('auth.errors.required')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return t('auth.errors.invalidEmail')
    if (!password) return t('auth.errors.required')
    return ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
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
            {t('auth.login')}
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                aria-required="true"
              />
            </div>

            {/* Remember me + Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--color-muted)' }}>
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded"
                />
                {t('auth.rememberMe')}
              </label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium hover:underline"
                style={{ color: 'var(--color-primary)' }}
              >
                {t('auth.forgotPassword')}
              </Link>
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
              {loading ? t('common.loading') : t('auth.login')}
            </button>
          </form>

          {/* Link to register */}
          <p className="text-center text-sm mt-4" style={{ color: 'var(--color-muted)' }}>
            {t('auth.noAccount')}{' '}
            <Link href="/register" className="font-semibold hover:underline" style={{ color: 'var(--color-primary)' }}>
              {t('auth.signUp')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
