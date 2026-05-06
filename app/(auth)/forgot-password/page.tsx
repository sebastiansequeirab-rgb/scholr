'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'

export default function ForgotPasswordPage() {
  const { t, language } = useTranslation()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

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
    if (resetError) setError(resetError.message)
    else setSuccess(true)
  }

  const isLight = mounted && resolvedTheme === 'light'

  return (
    <div data-theme="indigo" className="min-h-screen w-full flex items-center justify-center p-6 relative" style={{ background: 'var(--s-bg)' }}>
      <div className="absolute top-5 right-5" suppressHydrationWarning>
        <div className="theme-toggle">
          <button className={isLight ? 'active' : ''} onClick={() => setTheme('light')} aria-label="Light mode">
            <span className="material-symbols-outlined">light_mode</span>
          </button>
          <button className={!isLight ? 'active' : ''} onClick={() => setTheme('dark')} aria-label="Dark mode">
            <span className="material-symbols-outlined">dark_mode</span>
          </button>
        </div>
      </div>

      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-7">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-[10px]"
            style={{ background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)' }}>
            <Image src={isLight ? '/logo-icon-blue.png' : '/logo-icon-white.png'} alt="Skolar" width={22} height={22} />
            <div className="text-[15px] font-bold" style={{ letterSpacing: '-0.018em', color: 'var(--on-surface)' }}>Skolar</div>
          </div>
        </div>

        <div className="card" style={{ padding: 24 }}>
          {success ? (
            <div className="text-center">
              <div className="inline-flex w-12 h-12 rounded-[12px] items-center justify-center mb-3"
                style={{ background: 'color-mix(in srgb, var(--success) 16%, transparent)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--success)', fontVariationSettings: "'FILL' 1" }}>
                  mark_email_read
                </span>
              </div>
              <h1 className="text-[18px] font-bold mb-1" style={{ color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>
                <span className="serif">Listo.</span>
              </h1>
              <p className="text-[12.5px]" style={{ color: 'var(--on-surface-variant)' }}>
                {language === 'es' ? 'Te enviamos un enlace a' : 'We sent a link to'}
              </p>
              <p className="font-mono text-[12.5px] font-semibold my-1.5" style={{ color: 'var(--color-primary)' }}>
                {email}
              </p>
              <p className="text-[11.5px] mt-2" style={{ color: 'var(--color-outline)' }}>
                {language === 'es'
                  ? 'Hacé click desde tu correo para restablecer tu contraseña.'
                  : 'Click the link in the email to reset your password.'}
              </p>
              <Link href="/login" className="btn btn-primary mt-5 w-full" style={{ height: 42, fontSize: 13 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
                {t('auth.backToLogin')}
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-[20px] font-bold leading-tight" style={{ color: 'var(--on-surface)', letterSpacing: '-0.025em' }}>
                <span className="serif">{language === 'es' ? '¿Olvidaste la contraseña?' : 'Forgot your password?'}</span>
              </h1>
              <p className="text-[12.5px] mt-1.5 mb-4" style={{ color: 'var(--on-surface-variant)' }}>
                {language === 'es'
                  ? 'Te enviamos un enlace para que la cambies en un minuto.'
                  : 'We’ll email you a link to set a new one.'}
              </p>

              <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
                <div>
                  <label htmlFor="email" className="label">{language === 'es' ? 'Correo' : 'Email'}</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="input"
                    style={{ height: 40 }}
                    placeholder="tu@universidad.edu"
                    aria-required="true"
                  />
                </div>

                {error && (
                  <div role="alert" className="text-[12px] rounded-[10px] px-3 py-2.5"
                    style={{
                      background: 'color-mix(in srgb, var(--danger) 14%, transparent)',
                      color: 'var(--danger)',
                      border: '1px solid color-mix(in srgb, var(--danger) 28%, transparent)',
                    }}>
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading} className="btn btn-primary w-full" style={{ height: 42, fontSize: 13 }}>
                  {loading ? t('common.loading') : t('auth.sendResetLink')}
                </button>

                <Link href="/login" className="text-center text-[12px] hover:underline" style={{ color: 'var(--color-outline)' }}>
                  ← {t('auth.backToLogin')}
                </Link>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
