'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'

type Role = 'student' | 'teacher'

export default function LoginPage() {
  const { t, language } = useTranslation()
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const [role, setRole] = useState<Role>('student')
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
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    router.push(role === 'teacher' ? '/teacher/dashboard' : '/dashboard')
    router.refresh()
  }

  const isLight = mounted && resolvedTheme === 'light'

  return (
    <div data-theme="indigo" className="min-h-screen w-full relative" style={{ backgroundColor: 'var(--s-bg)' }}>
      {/* Theme toggle (top right, floating) */}
      <div className="absolute top-5 right-5 z-20" suppressHydrationWarning>
        <div className="theme-toggle">
          <button
            className={isLight ? 'active' : ''}
            onClick={() => setTheme('light')}
            aria-label="Light mode"
          >
            <span className="material-symbols-outlined">light_mode</span>
          </button>
          <button
            className={!isLight ? 'active' : ''}
            onClick={() => setTheme('dark')}
            aria-label="Dark mode"
          >
            <span className="material-symbols-outlined">dark_mode</span>
          </button>
        </div>
      </div>

      <div className="login-grid grid min-h-screen">
        {/* ─────────── HERO (desktop only) ─────────── */}
        <div
          className="login-hero relative overflow-hidden hidden flex-col p-12"
          style={{
            background:
              'radial-gradient(circle at 18% 26%, color-mix(in srgb, var(--color-tertiary) 32%, transparent), transparent 42%),' +
              'radial-gradient(circle at 84% 78%, color-mix(in srgb, var(--color-primary) 50%, transparent), transparent 55%),' +
              'linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 92%, #000) 0%, color-mix(in srgb, var(--color-primary) 55%, #1a1a2e) 100%)',
            color: '#fff',
          }}
        >
          {/* Subtle grain overlay */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none opacity-[0.05] mix-blend-overlay"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.7'/></svg>\")",
            }}
          />

          {/* Logo */}
          <div className="relative z-10 flex items-center gap-3">
            <Image
              src="/logo-icon-white.png"
              alt="Skolar"
              width={44}
              height={44}
              priority
              style={{ width: 44, height: 44, objectFit: 'contain' }}
            />
            <div>
              <div className="text-[22px] font-bold leading-none" style={{ letterSpacing: '-0.02em' }}>
                Skolar
              </div>
              <div
                className="font-mono text-[9.5px] mt-1 leading-none"
                style={{ letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.7 }}
              >
                {t('auth.tag')}
              </div>
            </div>
          </div>

          {/* Title */}
          <h1
            className="display relative z-10 mt-10 max-w-[480px]"
            style={{ color: '#fff' }}
          >
            {role === 'student' ? (
              <>
                {t('auth.heroStudentTitle')}
                <br />
                <em className="serif">{t('auth.heroStudentTitleEm')}</em>
              </>
            ) : (
              <>
                {t('auth.heroTeacherTitle')} <em className="serif">{t('auth.heroTeacherTitleEm')}</em>
                <br />
                {t('auth.heroTeacherTitle2')}
              </>
            )}
          </h1>

          {/* Sub */}
          <p
            className="relative z-10 mt-4 text-[14px] leading-[1.55] max-w-[460px]"
            style={{ color: 'rgba(255,255,255,0.78)' }}
          >
            {role === 'student' ? t('auth.heroStudentSub') : t('auth.heroTeacherSub')}
          </p>

          {/* Features */}
          <div className="relative z-10 mt-auto flex flex-col gap-2.5">
            {[
              { icon: 'auto_awesome', text: t('auth.feat1') },
              { icon: 'calendar_month', text: t('auth.feat2') },
              { icon: 'trending_up', text: t('auth.feat3') },
            ].map((f, i) => (
              <div
                key={i}
                className="inline-flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[12.5px]"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.92)',
                  width: 'fit-content',
                }}
              >
                <span className="material-symbols-outlined text-[16px]" style={{ opacity: 0.95 }}>
                  {f.icon}
                </span>
                {f.text}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div
            className="relative z-10 mt-8 font-mono text-[9.5px]"
            style={{
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.45)',
            }}
          >
            © {new Date().getFullYear()} Skolar — Asistente Académico
          </div>
        </div>

        {/* ─────────── FORM ─────────── */}
        <div className="flex items-center justify-center p-6 lg:p-12" style={{ background: 'var(--s-bg)' }}>
          <div className="w-full" style={{ maxWidth: 380 }}>
            {/* Mobile-only logo */}
            <div className="lg:hidden flex justify-center mb-7">
              <div
                className="flex items-center gap-2.5 px-3 py-2 rounded-[10px]"
                style={{ background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)' }}
              >
                <Image
                  src={isLight ? '/logo-icon-blue.png' : '/logo-icon-white.png'}
                  alt="Skolar"
                  width={22}
                  height={22}
                />
                <div className="text-[15px] font-bold" style={{ letterSpacing: '-0.018em', color: 'var(--on-surface)' }}>
                  Skolar
                </div>
              </div>
            </div>

            {/* Role switch */}
            <div
              className="grid grid-cols-2 gap-1.5 p-1 rounded-[12px] mb-5"
              style={{
                background: 'var(--s-low)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {(['student', 'teacher'] as Role[]).map(r => {
                const active = role === r
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-[9px] transition-all"
                    style={{
                      background: active
                        ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)'
                        : 'transparent',
                      color: active ? 'var(--color-primary)' : 'var(--on-surface-variant)',
                    }}
                  >
                    <span
                      className="material-symbols-outlined text-[19px]"
                      style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
                    >
                      {r === 'student' ? 'school' : 'co_present'}
                    </span>
                    <div className="flex-1 text-left min-w-0">
                      <div className="text-[12.5px] font-bold leading-tight">
                        {t(`auth.role${r === 'student' ? 'Student' : 'Teacher'}`)}
                      </div>
                      <div
                        className="text-[10.5px] leading-tight mt-0.5 truncate"
                        style={{ color: active ? 'var(--color-primary)' : 'var(--color-outline)', opacity: 0.85 }}
                      >
                        {t(`auth.${r}Sub`)}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Title */}
            <h2
              className="text-[24px] font-bold leading-tight"
              style={{ color: 'var(--on-surface)', letterSpacing: '-0.025em' }}
            >
              {role === 'student' ? t('auth.welcomeBack') : t('auth.welcomeTeacher')}
            </h2>
            <p
              className="text-[12.5px] mt-1.5 mb-5"
              style={{ color: 'var(--on-surface-variant)' }}
            >
              {role === 'student' ? t('auth.loginSubStudent') : t('auth.loginSubTeacher')}
            </p>

            {/* Divider */}
            <div className="flex items-center gap-2.5 my-4">
              <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
              <span
                className="font-mono text-[9.5px] font-semibold"
                style={{ letterSpacing: '0.14em', color: 'var(--color-outline)' }}
              >
                {t('auth.orWithEmail')}
              </span>
              <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
            </div>

            {/* Form */}
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
                  placeholder={role === 'student' ? 'sebastian@universidad.edu' : 'gabriel.bravo@universidad.edu'}
                  style={{ height: 40 }}
                  aria-required="true"
                />
              </div>

              <div>
                <label htmlFor="password" className="label">{t('auth.password')}</label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input"
                  placeholder="••••••••"
                  style={{ height: 40 }}
                  aria-required="true"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="inline-flex items-center gap-1.5 text-[11.5px] cursor-pointer" style={{ color: 'var(--on-surface-variant)' }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    style={{ accentColor: 'var(--color-primary)' }}
                  />
                  {t('auth.rememberMe')}
                </label>
                <Link
                  href="/forgot-password"
                  className="text-[11.5px] font-semibold hover:underline"
                  style={{ color: 'var(--color-primary)' }}
                >
                  {t('auth.forgotPassword')}
                </Link>
              </div>

              {error && (
                <div
                  role="alert"
                  className="text-[12px] rounded-[10px] px-3 py-2.5"
                  style={{
                    background: 'color-mix(in srgb, var(--danger) 14%, transparent)',
                    color: 'var(--danger)',
                    border: '1px solid color-mix(in srgb, var(--danger) 28%, transparent)',
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full mt-1"
                style={{ height: 44, fontSize: 13.5 }}
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>hourglass_top</span>
                    {language === 'es' ? 'Cargando…' : 'Loading…'}
                  </>
                ) : (
                  <>
                    {role === 'student' ? t('auth.submitStudent') : t('auth.submitTeacher')}
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
                  </>
                )}
              </button>
            </form>

            <p className="text-center text-[12px] mt-5" style={{ color: 'var(--on-surface-variant)' }}>
              {t('auth.noAccount')}{' '}
              <Link href="/register" className="font-semibold hover:underline" style={{ color: 'var(--color-primary)' }}>
                {t('auth.signUp')}
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Login grid responsive: hero left + form right on lg */}
      <style>{`
        .login-grid { grid-template-columns: 1fr; }
        @media (min-width: 900px) {
          .login-grid { grid-template-columns: 1.05fr 1fr; }
          .login-hero { display: flex !important; }
        }
      `}</style>
    </div>
  )
}
