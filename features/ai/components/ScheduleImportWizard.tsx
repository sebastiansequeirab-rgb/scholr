'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SUBJECT_COLORS } from '@/types'
import { getSubjectIcon } from '@/features/subjects/utils'

type WizardStep = 'upload' | 'parsing' | 'review' | 'saving' | 'done'
type SaveMode = 'merge' | 'replace'

interface ScheduleBlock {
  _key: string
  day_of_week: number
  start_time: string
  end_time: string
  room: string | null
}

interface EditableSubject {
  _key: string
  _included: boolean
  _matchedId: string | null
  name: string
  professor: string | null
  color: string
  icon: string
  schedules: ScheduleBlock[]
}

const DAY_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const COMMON_ICONS = [
  'menu_book', 'calculate', 'science', 'speed', 'biotech', 'history_edu',
  'translate', 'code', 'palette', 'music_note', 'trending_up', 'business_center',
  'engineering', 'gavel', 'architecture', 'medical_services', 'fitness_center', 'lab_research',
  'assignment', 'school', 'psychology', 'bar_chart', 'view_in_ar', 'electrical_services',
]

interface Props {
  language: 'es' | 'en'
  onDone: () => void
}

export function ScheduleImportWizard({ language, onDone }: Props) {
  const [step, setStep]                   = useState<WizardStep>('upload')
  const [imageFile, setImageFile]         = useState<File | null>(null)
  const [imagePreview, setImagePreview]   = useState<string | null>(null)
  const [parseError, setParseError]       = useState('')
  const [subjects, setSubjects]           = useState<EditableSubject[]>([])
  const [saveMode, setSaveMode]           = useState<SaveMode>('merge')
  const [hasExisting, setHasExisting]     = useState(false)
  const [matchCount, setMatchCount]       = useState(0)
  const [saveProgress, setSaveProgress]   = useState({ current: 0, total: 0 })
  const [iconPickerKey, setIconPickerKey] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const t = (es: string, en: string) => language === 'es' ? es : en
  const dayNames = language === 'es' ? DAY_ES : DAY_EN

  /* ─── File selection ──────────────────────────────────────────────────── */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setParseError(t('Solo JPG, PNG o WEBP.', 'Only JPG, PNG or WEBP.'))
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setParseError(t('La imagen no puede superar 10 MB.', 'Image must be under 10 MB.'))
      return
    }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setParseError('')
  }

  /* ─── Parse ───────────────────────────────────────────────────────────── */
  const handleParse = async () => {
    if (!imageFile) return
    setStep('parsing')
    setParseError('')
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload  = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(imageFile)
      })

      const res = await fetch('/api/parse-schedule', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: imageFile.type }),
      })

      if (res.status === 429) throw new Error(t('Demasiadas solicitudes. Espera un momento.', 'Too many requests. Please wait.'))
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      if (!data.subjects?.length) throw new Error(t('No se detectaron materias en la imagen.', 'No subjects detected in the image.'))

      // Fetch existing subjects to detect name conflicts
      const supabase = createClient()
      const { data: existing } = await supabase.from('subjects').select('id, name')
      const existingList: { id: string; name: string }[] = existing || []
      setHasExisting(existingList.length > 0)

      const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ')
      let matches = 0

      const editable: EditableSubject[] = (data.subjects as {
        name: string
        professor: string | null
        color: string
        icon: string
        schedules: { day_of_week: number; start_time: string; end_time: string; room: string | null }[]
      }[]).map((s, idx) => {
        const matched = existingList.find(ex => {
          const n1 = normalize(ex.name), n2 = normalize(s.name)
          return n1 === n2 || n1.includes(n2) || n2.includes(n1)
        })
        if (matched) matches++
        return {
          _key:       `s${idx}`,
          _included:  true,
          _matchedId: matched?.id ?? null,
          name:       s.name,
          professor:  s.professor,
          color:      SUBJECT_COLORS.includes(s.color) ? s.color : SUBJECT_COLORS[idx % SUBJECT_COLORS.length],
          icon:       s.icon || getSubjectIcon(s.name),
          schedules:  s.schedules.map((b, bi) => ({ ...b, _key: `s${idx}b${bi}` })),
        }
      })

      setMatchCount(matches)
      setSubjects(editable)
      setStep('review')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('Error al procesar la imagen.', 'Error processing the image.')
      setParseError(msg)
      setStep('upload')
    }
  }

  /* ─── Editing helpers ─────────────────────────────────────────────────── */
  const patchSubject = useCallback((key: string, patch: Partial<EditableSubject>) =>
    setSubjects(prev => prev.map(s => s._key === key ? { ...s, ...patch } : s)), [])

  const patchBlock = useCallback((sKey: string, bKey: string, patch: Partial<ScheduleBlock>) =>
    setSubjects(prev => prev.map(s =>
      s._key === sKey
        ? { ...s, schedules: s.schedules.map(b => b._key === bKey ? { ...b, ...patch } : b) }
        : s
    )), [])

  const removeBlock = useCallback((sKey: string, bKey: string) =>
    setSubjects(prev => prev.map(s =>
      s._key === sKey ? { ...s, schedules: s.schedules.filter(b => b._key !== bKey) } : s
    )), [])

  const addBlock = useCallback((sKey: string) =>
    setSubjects(prev => prev.map(s =>
      s._key === sKey
        ? { ...s, schedules: [...s.schedules, { _key: `new${Date.now()}`, day_of_week: 1, start_time: '08:00', end_time: '09:30', room: null }] }
        : s
    )), [])

  /* ─── Save ────────────────────────────────────────────────────────────── */
  const handleSave = async () => {
    const toSave = subjects.filter(s => s._included)
    if (!toSave.length) return
    setStep('saving')
    setSaveProgress({ current: 0, total: toSave.length })
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      if (saveMode === 'replace') {
        await supabase.from('schedules').delete().eq('user_id', user.id)
        await supabase.from('subjects').delete().eq('user_id', user.id)
      }

      for (let i = 0; i < toSave.length; i++) {
        const s = toSave[i]
        setSaveProgress({ current: i + 1, total: toSave.length })

        if (saveMode === 'merge' && s._matchedId) {
          // Update schedules for matched existing subject
          await supabase.from('schedules').delete().eq('subject_id', s._matchedId).eq('user_id', user.id)
          for (const b of s.schedules) {
            await supabase.from('schedules').insert({
              user_id: user.id, subject_id: s._matchedId,
              day_of_week: b.day_of_week, start_time: b.start_time, end_time: b.end_time, room: b.room,
            })
          }
        } else {
          // Insert new subject + schedules
          const { data: ins } = await supabase
            .from('subjects')
            .insert({ user_id: user.id, name: s.name, professor: s.professor, color: s.color, icon: s.icon })
            .select('id').single()
          if (!ins) continue
          for (const b of s.schedules) {
            await supabase.from('schedules').insert({
              user_id: user.id, subject_id: ins.id,
              day_of_week: b.day_of_week, start_time: b.start_time, end_time: b.end_time, room: b.room,
            })
          }
        }
      }
      setStep('done')
    } catch {
      setParseError(t('Error al guardar. Intenta de nuevo.', 'Save error. Try again.'))
      setStep('review')
    }
  }

  const reset = () => {
    setStep('upload'); setImageFile(null); setImagePreview(null)
    setParseError(''); setSubjects([]); setSaveMode('merge')
  }

  /* ─── STEP: upload ────────────────────────────────────────────────────── */
  if (step === 'upload') return (
    <div className="space-y-4">
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
        className="hidden" onChange={handleFileChange} />

      <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}>
        <p className="text-sm mb-4" style={{ color: 'var(--color-outline)' }}>
          {t(
            'Sube la foto de tu horario universitario. La IA lo analiza, tú revisas y corriges, luego guardas.',
            'Upload a photo of your university schedule. AI analyzes it, you review and edit, then save.'
          )}
        </p>

        {!imagePreview ? (
          <button onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-2xl border-2 border-dashed py-12 flex flex-col items-center gap-3 transition-all hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5"
            style={{ borderColor: 'var(--border-default)', color: 'var(--color-outline)' }}>
            <span className="material-symbols-outlined text-[40px]">add_photo_alternate</span>
            <span className="text-sm font-semibold">{t('Toca para subir imagen', 'Tap to upload image')}</span>
            <span className="text-xs opacity-60">JPG · PNG · WEBP · máx 10 MB</span>
          </button>
        ) : (
          <div className="space-y-3">
            <div className="relative rounded-xl overflow-hidden">
              <img src={imagePreview} alt="preview" className="w-full max-h-64 object-contain rounded-xl"
                style={{ backgroundColor: 'var(--s-base)' }} />
              <button
                onClick={() => { setImageFile(null); setImagePreview(null); setParseError('') }}
                className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110"
                style={{ backgroundColor: 'var(--s-high)', color: 'var(--color-outline)' }}>
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
            <button onClick={handleParse} className="btn-primary w-full flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
              {t('Analizar con IA', 'Analyze with AI')}
            </button>
          </div>
        )}

        {parseError && (
          <p className="mt-3 text-xs px-3 py-2.5 rounded-xl"
            style={{ backgroundColor: 'var(--priority-high-bg)', color: 'var(--danger)' }}>
            {parseError}
          </p>
        )}
      </div>
    </div>
  )

  /* ─── STEP: parsing ───────────────────────────────────────────────────── */
  if (step === 'parsing') return (
    <div className="rounded-2xl p-14 flex flex-col items-center gap-6"
      style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}>
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ backgroundColor: 'color-mix(in srgb, var(--color-tertiary) 12%, transparent)' }}>
        <span className="material-symbols-outlined text-[32px] animate-spin"
          style={{ color: 'var(--color-tertiary)', fontVariationSettings: "'FILL' 1" }}>
          progress_activity
        </span>
      </div>
      <div className="text-center">
        <p className="font-bold text-sm" style={{ color: 'var(--on-surface)' }}>
          {t('Analizando tu horario…', 'Analyzing your schedule…')}
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--color-outline)' }}>
          {t('La IA está extrayendo materias y bloques horarios', 'AI is extracting subjects and time blocks')}
        </p>
      </div>
    </div>
  )

  /* ─── STEP: review ────────────────────────────────────────────────────── */
  if (step === 'review') {
    const includedCount = subjects.filter(s => s._included).length
    return (
      <div className="space-y-4">
        {/* Header info */}
        <div className="rounded-2xl px-5 py-4 space-y-3"
          style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-tertiary) 12%, transparent)' }}>
              <span className="material-symbols-outlined text-[18px]"
                style={{ color: 'var(--color-tertiary)', fontVariationSettings: "'FILL' 1" }}>
                auto_awesome
              </span>
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color: 'var(--on-surface)' }}>
                {subjects.length} {t('materia(s) detectada(s)', 'subject(s) detected')}
              </p>
              <p className="text-xs" style={{ color: 'var(--color-outline)' }}>
                {t('Revisa y corrige antes de guardar. Todos los campos son editables.', 'Review and correct before saving. All fields are editable.')}
              </p>
            </div>
          </div>
          {matchCount > 0 && (
            <div className="flex items-start gap-2 text-xs px-3 py-2.5 rounded-xl"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, transparent)', color: 'var(--color-primary)' }}>
              <span className="material-symbols-outlined text-[14px] flex-shrink-0 mt-0.5">sync</span>
              <span>
                {t(
                  `${matchCount} materia(s) coinciden con las existentes y actualizarán sus horarios.`,
                  `${matchCount} subject(s) match existing ones and will update their schedules.`
                )}
              </span>
            </div>
          )}
        </div>

        {/* Editable subject cards */}
        {subjects.map(s => (
          <div key={s._key} className="rounded-2xl overflow-hidden transition-opacity"
            style={{
              border: '1px solid var(--border-subtle)',
              opacity: s._included ? 1 : 0.45,
            }}>

            {/* Subject header row */}
            <div className="px-4 pt-4 pb-3 flex items-start gap-3"
              style={{ backgroundColor: `color-mix(in srgb, ${s.color} 5%, var(--s-low))` }}>

              {/* Icon + inline picker */}
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setIconPickerKey(iconPickerKey === s._key ? null : s._key)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:brightness-125"
                  style={{ backgroundColor: `color-mix(in srgb, ${s.color} 15%, transparent)` }}
                  title={t('Cambiar ícono', 'Change icon')}
                >
                  <span className="material-symbols-outlined text-[18px]" style={{ color: s.color }}>
                    {s.icon}
                  </span>
                </button>
                {iconPickerKey === s._key && (
                  <div className="absolute left-0 top-11 z-30 rounded-xl p-2 shadow-lg grid grid-cols-6 gap-1"
                    style={{ backgroundColor: 'var(--s-high)', border: '1px solid var(--border-default)', width: '192px' }}>
                    {COMMON_ICONS.map(ic => (
                      <button key={ic}
                        onClick={() => { patchSubject(s._key, { icon: ic }); setIconPickerKey(null) }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:bg-black/10 dark:hover:bg-white/10"
                        style={{ backgroundColor: s.icon === ic ? `color-mix(in srgb, ${s.color} 15%, transparent)` : 'transparent' }}>
                        <span className="material-symbols-outlined text-[15px]"
                          style={{ color: s.icon === ic ? s.color : 'var(--color-outline)' }}>
                          {ic}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Name + professor inputs */}
              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                <input
                  value={s.name}
                  onChange={e => patchSubject(s._key, { name: e.target.value })}
                  className="input text-sm font-bold py-1.5"
                  placeholder={t('Nombre de la materia', 'Subject name')}
                />
                <input
                  value={s.professor ?? ''}
                  onChange={e => patchSubject(s._key, { professor: e.target.value || null })}
                  className="input text-xs py-1"
                  placeholder={t('Profesor / código (opcional)', 'Professor / code (optional)')}
                />
              </div>

              {/* Include/exclude toggle */}
              <button
                onClick={() => patchSubject(s._key, { _included: !s._included })}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-all"
                style={{
                  backgroundColor: s._included ? `color-mix(in srgb, ${s.color} 15%, transparent)` : 'var(--s-base)',
                  color: s._included ? s.color : 'var(--color-outline)',
                }}
                title={s._included ? t('Excluir del import', 'Exclude from import') : t('Incluir', 'Include')}
              >
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {s._included ? 'check_circle' : 'radio_button_unchecked'}
                </span>
              </button>
            </div>

            {/* Color picker */}
            <div className="px-4 py-2 flex items-center gap-2 flex-wrap"
              style={{ backgroundColor: 'var(--s-base)', borderTop: '1px solid var(--border-subtle)' }}>
              <span className="text-[10px] font-semibold uppercase tracking-wide flex-shrink-0" style={{ color: 'var(--color-outline)' }}>
                {t('Color', 'Color')}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {SUBJECT_COLORS.map(c => (
                  <button key={c} onClick={() => patchSubject(s._key, { color: c })}
                    className="w-4 h-4 rounded-full transition-all hover:scale-125 flex-shrink-0"
                    style={{
                      backgroundColor: c,
                      outline: s.color === c ? `2px solid ${c}` : 'none',
                      outlineOffset: '2px',
                    }}
                  />
                ))}
              </div>
              {s._matchedId && (
                <span className="ml-auto flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', color: 'var(--color-primary)' }}>
                  <span className="material-symbols-outlined text-[11px]">sync</span>
                  {t('Actualiza horario', 'Updates schedule')}
                </span>
              )}
            </div>

            {/* Schedule blocks */}
            <div className="px-4 pb-4 pt-3 space-y-2" style={{ backgroundColor: 'var(--s-base)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-outline)' }}>
                {t('Bloques horarios', 'Time blocks')}
              </p>
              {s.schedules.map(b => (
                <div key={b._key} className="flex items-center gap-2 flex-wrap">
                  <select
                    value={b.day_of_week}
                    onChange={e => patchBlock(s._key, b._key, { day_of_week: Number(e.target.value) })}
                    className="input text-xs py-1 flex-shrink-0"
                    style={{ width: '72px' }}>
                    {dayNames.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                  <input type="time" value={b.start_time}
                    onChange={e => patchBlock(s._key, b._key, { start_time: e.target.value })}
                    className="input text-xs py-1 flex-shrink-0" style={{ width: '96px' }} />
                  <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-outline)' }}>–</span>
                  <input type="time" value={b.end_time}
                    onChange={e => patchBlock(s._key, b._key, { end_time: e.target.value })}
                    className="input text-xs py-1 flex-shrink-0" style={{ width: '96px' }} />
                  <input
                    value={b.room ?? ''}
                    onChange={e => patchBlock(s._key, b._key, { room: e.target.value || null })}
                    className="input text-xs py-1 flex-1 min-w-[64px]"
                    placeholder={t('Aula', 'Room')} />
                  <button onClick={() => removeBlock(s._key, b._key)}
                    className="w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0 transition-all hover:bg-red-400/15"
                    style={{ color: 'var(--danger)' }}>
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                </div>
              ))}
              <button onClick={() => addBlock(s._key)}
                className="flex items-center gap-1 text-xs font-semibold mt-1 transition-all hover:opacity-70"
                style={{ color: 'var(--color-primary)' }}>
                <span className="material-symbols-outlined text-[14px]">add</span>
                {t('Agregar bloque', 'Add block')}
              </button>
            </div>
          </div>
        ))}

        {/* Save mode selector — only when user already has subjects */}
        {hasExisting && (
          <div className="rounded-2xl px-5 py-4 space-y-3"
            style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--on-surface)' }}>
              {t('Modo de guardado', 'Save mode')}
            </p>
            {(['merge', 'replace'] as SaveMode[]).map(mode => (
              <label key={mode} className="flex items-start gap-3 cursor-pointer p-2 rounded-xl transition-all hover:bg-white/5">
                <input type="radio" name="saveMode" value={mode}
                  checked={saveMode === mode} onChange={() => setSaveMode(mode)}
                  className="mt-0.5 flex-shrink-0 accent-[var(--color-primary)]" />
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--on-surface)' }}>
                    {mode === 'merge'
                      ? t('Agregar y actualizar', 'Add and update')
                      : t('Reemplazar todo', 'Replace all')}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-outline)' }}>
                    {mode === 'merge'
                      ? t('Crea materias nuevas y actualiza horarios de las que coinciden. No toca el resto.', 'Creates new subjects and updates schedules for matching ones. Leaves others untouched.')
                      : t('⚠️ Borra todas las materias y horarios actuales. Acción irreversible.', '⚠️ Deletes all current subjects and schedules. Irreversible action.')}
                  </p>
                </div>
              </label>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button onClick={reset} className="btn-secondary flex-1">
            {t('Cancelar', 'Cancel')}
          </button>
          <button onClick={handleSave} disabled={includedCount === 0}
            className="btn-primary flex-1"
            style={{ opacity: includedCount === 0 ? 0.5 : 1 }}>
            {t(`Guardar ${includedCount} materia(s)`, `Save ${includedCount} subject(s)`)}
          </button>
        </div>

        {parseError && (
          <p className="text-xs px-3 py-2.5 rounded-xl"
            style={{ backgroundColor: 'var(--priority-high-bg)', color: 'var(--danger)' }}>
            {parseError}
          </p>
        )}
      </div>
    )
  }

  /* ─── STEP: saving ────────────────────────────────────────────────────── */
  if (step === 'saving') return (
    <div className="rounded-2xl p-14 flex flex-col items-center gap-6"
      style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}>
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ backgroundColor: 'color-mix(in srgb, var(--success) 12%, transparent)' }}>
        <span className="material-symbols-outlined text-[32px] animate-spin"
          style={{ color: 'var(--success)', fontVariationSettings: "'FILL' 1" }}>
          progress_activity
        </span>
      </div>
      <div className="text-center">
        <p className="font-bold text-sm" style={{ color: 'var(--on-surface)' }}>
          {t('Guardando…', 'Saving…')} {saveProgress.current}/{saveProgress.total}
        </p>
        <div className="mt-3 w-48 h-1.5 rounded-full overflow-hidden mx-auto"
          style={{ backgroundColor: 'var(--s-high)' }}>
          <div className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${saveProgress.total > 0 ? (saveProgress.current / saveProgress.total) * 100 : 0}%`,
              backgroundColor: 'var(--success)',
            }} />
        </div>
      </div>
    </div>
  )

  /* ─── STEP: done ──────────────────────────────────────────────────────── */
  return (
    <div className="rounded-2xl p-12 flex flex-col items-center gap-5 text-center"
      style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}>
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ backgroundColor: 'color-mix(in srgb, var(--success) 12%, transparent)' }}>
        <span className="material-symbols-outlined text-[36px]"
          style={{ color: 'var(--success)', fontVariationSettings: "'FILL' 1" }}>
          check_circle
        </span>
      </div>
      <div>
        <p className="font-bold text-base" style={{ color: 'var(--on-surface)' }}>
          {t('¡Horario importado!', 'Schedule imported!')}
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--color-outline)' }}>
          {t('Tus materias y horarios están listos.', 'Your subjects and schedules are ready.')}
        </p>
      </div>
      <div className="flex gap-3">
        <a href="/subjects" className="btn-secondary flex items-center gap-2 text-sm">
          <span className="material-symbols-outlined text-[16px]">menu_book</span>
          {t('Ver materias', 'View subjects')}
        </a>
        <a href="/calendar" className="btn-primary flex items-center gap-2 text-sm">
          <span className="material-symbols-outlined text-[16px]">calendar_month</span>
          {t('Ver calendario', 'View calendar')}
        </a>
      </div>
      <button onClick={() => { reset(); onDone() }}
        className="text-xs transition-all hover:opacity-70" style={{ color: 'var(--color-outline)' }}>
        {t('Importar otro horario', 'Import another schedule')}
      </button>
    </div>
  )
}
