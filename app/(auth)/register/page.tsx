'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'

type Role = 'student' | 'teacher'

export default function RegisterPage() {
  const { t, language } = useTranslation()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const [role, setRole] = useState<Role>('student')
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
      options: { data: { full_name: fullName, language: browserLang, role } },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    setSent(true)
  }

  const isLight = mounted && resolvedTheme === 'light'

  if (sent) {
    return (
      <div data-theme="indigo" className="min-h-screen w-full flex items-center justify-center p-6" style={{ background: 'var(--s-bg)' }}>
        <div className="card text-center max-w-sm w-full" style={{ padding: 28 }}>
          <div className="inline-flex w-14 h-14 rounded-[14px] items-center justify-center mb-4"
            style={{ background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>
              mark_email_unread
            </span>
          </div>
          <h1 className="text-[22px] font-bold mb-2" style={{ color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>
            <span className="serif">Revisá tu correo</span>
          </h1>
          <p className="text-[13px]" style={{ color: 'var(--on-surface-variant)' }}>
            {language === 'es' ? 'Enviamos un enlace de confirmación a' : 'We sent a confirmation link to'}
          </p>
          <p className="font-mono text-[13px] font-semibold my-2" style={{ color: 'var(--color-primary)' }}>
            {email}
          </p>
          <p className="text-[12px] mt-4" style={{ color: 'var(--color-outline)' }}>
            {language === 'es'
              ? 'Abrí el correo y hacé click en el enlace para activar tu cuenta.'
              : 'Open the email and click the link to activate your account.'}
          </p>
          <div className="mt-6 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <Link href="/login" className="text-[12.5px] font-semibold hover:underline" style={{ color: 'var(--color-primary)' }}>
              {language === 'es' ? '← Volver al login' : '← Back to login'}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div data-theme="indigo" className="min-h-screen w-full relative" style={{ backgroundColor: 'var(--s-bg)' }}>
      {/* Theme toggle */}
      <div className="absolute top-5 right-5 z-20" suppressHydrationWarning>
        <div className="theme-toggle">
          <button className={isLight ? 'active' : ''} onClick={() => setTheme('light')} aria-label="Light mode">
            <span className="material-symbols-outlined">light_mode</span>
          </button>
          <button className={!isLight ? 'active' : ''} onClick={() => setTheme('dark')} aria-label="Dark mode">
            <span className="material-symbols-outlined">dark_mode</span>
          </button>
        </div>
      </div>

      <div className="register-grid grid min-h-screen">
        {/* Hero */}
        <div
          className="register-hero relative overflow-hidden hidden flex-col p-12"
          style={{
            background:
              'radial-gradient(circle at 20% 30%, color-mix(in srgb, var(--color-tertiary) 32%, transparent), transparent 40%),' +
              'radial-gradient(circle at 80% 70%, color-mix(in srgb, var(--color-primary) 50%, transparent), transparent 55%),' +
              'linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 92%, #000) 0%, color-mix(in srgb, var(--color-primary) 55%, #1a1a2e) 100%)',
            color: '#fff',
          }}
        >
          <div className="relative z-10 flex items-center gap-3">
            <Image src="/logo-icon-white.png" alt="Skolar" width={44} height={44} priority style={{ width: 44, height: 44, objectFit: 'contain' }} />
            <div>
              <div className="text-[22px] font-bold leading-none" style={{ letterSpacing: '-0.02em' }}>Skolar</div>
              <div className="font-mono text-[9.5px] mt-1 leading-none" style={{ letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.7 }}>
                {t('auth.tag')}
              </div>
            </div>
          </div>

          <h1 className="display relative z-10 mt-10 max-w-[480px]" style={{ color: '#fff' }}>
            {language === 'es' ? (
              <>Empezá tu <em className="serif">primer ciclo</em> con Skolar.</>
            ) : (
              <>Start your <em className="serif">first term</em> with Skolar.</>
            )}
          </h1>

          <p className="relative z-10 mt-4 text-[14px] leading-[1.55] max-w-[460px]" style={{ color: 'rgba(255,255,255,0.78)' }}>
            {language === 'es'
              ? 'Creá tu cuenta institucional y arrancá a usar tu copiloto académico hoy mismo. Es gratis para estudiantes.'
              : 'Create your institutional account and start using your academic copilot today. Free for students.'}
          </p>

          <div className="relative z-10 mt-auto flex flex-col gap-2.5">
            {[
              { icon: 'auto_awesome', text: t('auth.feat1') },
              { icon: 'calendar_month', text: t('auth.feat2') },
              { icon: 'trending_up', text: t('auth.feat3') },
            ].map((f, i) => (
              <div key={i}
                className="inline-flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[12.5px]"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.92)',
                  width: 'fit-content',
                }}>
                <span className="material-symbols-outlined text-[16px]" style={{ opacity: 0.95 }}>{f.icon}</span>
                {f.text}
              </div>
            ))}
          </div>
        </div>

        {/* Form */}
        <div className="flex items-center justify-center p-6 lg:p-12 overflow-y-auto" style={{ background: 'var(--s-bg)' }}>
          <div className="w-full" style={{ maxWidth: 380 }}>
            <div className="lg:hidden flex justify-center mb-6">
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-[10px]"
                style={{ background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)' }}>
                <Image src={isLight ? '/logo-icon-blue.png' : '/logo-icon-white.png'} alt="Skolar" width={22} height={22} />
                <div className="text-[15px] font-bold" style={{ letterSpacing: '-0.018em', color: 'var(--on-surface)' }}>Skolar</div>
              </div>
            </div>

            {/* Role switch */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-[12px] mb-5"
              style={{ background: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}>
              {(['student', 'teacher'] as Role[]).map(r => {
                const active = role === r
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-[9px] transition-all"
                    style={{
                      background: active ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)' : 'transparent',
                      color: active ? 'var(--color-primary)' : 'var(--on-surface-variant)',
                    }}
                  >
                    <span className="material-symbols-outlined text-[19px]"
                      style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}>
                      {r === 'student' ? 'school' : 'co_present'}
                    </span>
                    <div className="flex-1 text-left min-w-0">
                      <div className="text-[12.5px] font-bold leading-tight">
                        {t(`auth.role${r === 'student' ? 'Student' : 'Teacher'}`)}
                      </div>
                      <div className="text-[10.5px] leading-tight mt-0.5 truncate"
                        style={{ color: active ? 'var(--color-primary)' : 'var(--color-outline)', opacity: 0.85 }}>
                        {t(`auth.${r}Sub`)}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            <h2 className="text-[24px] font-bold leading-tight" style={{ color: 'var(--on-surface)', letterSpacing: '-0.025em' }}>
              <span className="serif">{language === 'es' ? 'Crea tu cuenta.' : 'Create your account.'}</span>
            </h2>
            <p className="text-[12.5px] mt-1.5 mb-5" style={{ color: 'var(--on-surface-variant)' }}>
              {language === 'es' ? 'Solo te pedimos lo esencial.' : 'We only ask for what we need.'}
            </p>

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
              <div>
                <label htmlFor="fullName" className="label">{t('auth.fullName')}</label>
                <input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="input"
                  style={{ height: 40 }}
                  aria-required="true"
                />
              </div>

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

              <div>
                <label htmlFor="password" className="label">{t('auth.password')}</label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input"
                  style={{ height: 40 }}
                  aria-required="true"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="label">{t('auth.confirmPassword')}</label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="input"
                  style={{ height: 40 }}
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

              <button type="submit" disabled={loading} className="btn btn-primary w-full mt-1" style={{ height: 44, fontSize: 13.5 }}>
                {loading ? (
                  <>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>hourglass_top</span>
                    {language === 'es' ? 'Creando…' : 'Creating…'}
                  </>
                ) : (
                  <>
                    {t('auth.register')}
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
                  </>
                )}
              </button>
            </form>

            <p className="text-center text-[12px] mt-5" style={{ color: 'var(--on-surface-variant)' }}>
              {t('auth.haveAccount')}{' '}
              <Link href="/login" className="font-semibold hover:underline" style={{ color: 'var(--color-primary)' }}>
                {t('auth.signIn')}
              </Link>
            </p>
          </div>
        </div>
      </div>

      <style>{`
        .register-grid { grid-template-columns: 1fr; }
        @media (min-width: 900px) {
          .register-grid { grid-template-columns: 1.05fr 1fr; }
          .register-hero { display: flex !important; }
        }
      `}</style>
    </div>
  )
}
