'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ACTIVITY_TYPES } from '@/types'
import type { ActivityType, Subject } from '@/types'

type WizardStep = 'input' | 'parsing' | 'review' | 'saving' | 'done'
type InputMode  = 'image' | 'text'

interface ParsedEval {
  _key:              string
  _included:         boolean
  _duplicateWarning: boolean
  title:             string
  subject_id:        string | null
  subject_hint:      string | null
  exam_date:         string | null
  exam_time:         string | null
  percentage:        number | null
  activity_type:     ActivityType
  location:          string | null
  notes:             string | null
}

interface Props {
  language: 'es' | 'en'
  onDone: () => void
}

const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ')

export function EvaluationImportWizard({ language, onDone }: Props) {
  const [step, setStep]               = useState<WizardStep>('input')
  const [inputMode, setInputMode]     = useState<InputMode>('image')
  const [imageFile, setImageFile]     = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [textInput, setTextInput]     = useState('')
  const [parseError, setParseError]   = useState('')
  const [evals, setEvals]             = useState<ParsedEval[]>([])
  const [subjects, setSubjects]       = useState<Subject[]>([])
  const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0 })
  const [savedCount, setSavedCount]   = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const t = (es: string, en: string) => language === 'es' ? es : en

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
    if (inputMode === 'image' && !imageFile) return
    if (inputMode === 'text' && !textInput.trim()) return

    setStep('parsing')
    setParseError('')

    try {
      let body: Record<string, string>

      if (inputMode === 'image' && imageFile) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload  = () => resolve((reader.result as string).split(',')[1])
          reader.onerror = reject
          reader.readAsDataURL(imageFile)
        })
        body = { imageBase64: base64, mimeType: imageFile.type }
      } else {
        body = { text: textInput.trim() }
      }

      const res = await fetch('/api/parse-evaluations', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })

      if (res.status === 429) throw new Error(t('Demasiadas solicitudes. Espera un momento.', 'Too many requests. Please wait.'))
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      if (!data.evaluations?.length) throw new Error(t('No se detectaron evaluaciones.', 'No evaluations detected.'))

      // Fetch subjects for matching + duplicate check
      const supabase = createClient()
      const [{ data: subjectData }, { data: existingExams }] = await Promise.all([
        supabase.from('subjects').select('*').order('name'),
        supabase.from('exams').select('subject_id, title, exam_date'),
      ])
      const subjectList: Subject[] = subjectData || []
      setSubjects(subjectList)

      // Match subject_hint → subject_id
      const parsed: ParsedEval[] = (data.evaluations as {
        title: string; subject_hint: string | null; exam_date: string | null
        exam_time: string | null; percentage: number | null; activity_type: string
        location: string | null; notes: string | null
      }[]).map((e, idx) => {
        // Subject matching
        let matchedId: string | null = null
        if (e.subject_hint) {
          const hint = normalize(e.subject_hint)
          const found = subjectList.find(s => {
            const n = normalize(s.name)
            return n === hint || n.includes(hint) || hint.includes(n)
          })
          matchedId = found?.id ?? null
        }

        // Duplicate detection
        const isDuplicate = (existingExams || []).some(ex =>
          ex.subject_id === matchedId &&
          normalize(ex.title) === normalize(e.title) &&
          ex.exam_date === e.exam_date
        )

        const activityType: ActivityType =
          ['exam', 'workshop', 'activity', 'task', 'study_session'].includes(e.activity_type)
            ? (e.activity_type as ActivityType)
            : 'activity'

        return {
          _key:              `e${idx}`,
          _included:         true,
          _duplicateWarning: isDuplicate,
          title:             e.title,
          subject_id:        matchedId,
          subject_hint:      e.subject_hint,
          exam_date:         e.exam_date,
          exam_time:         e.exam_time,
          percentage:        e.percentage,
          activity_type:     activityType,
          location:          e.location,
          notes:             e.notes,
        }
      })

      setEvals(parsed)
      setStep('review')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('Error al procesar.', 'Processing error.')
      setParseError(msg)
      setStep('input')
    }
  }

  /* ─── Editing ─────────────────────────────────────────────────────────── */
  const patchEval = useCallback((key: string, patch: Partial<ParsedEval>) =>
    setEvals(prev => prev.map(e => e._key === key ? { ...e, ...patch } : e)), [])

  /* ─── Save ────────────────────────────────────────────────────────────── */
  const handleSave = async () => {
    const toSave = evals.filter(e => e._included)
    if (!toSave.length) return
    setStep('saving')
    setSaveProgress({ current: 0, total: toSave.length })
    let saved = 0

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      for (let i = 0; i < toSave.length; i++) {
        const e = toSave[i]
        setSaveProgress({ current: i + 1, total: toSave.length })

        // Skip duplicates that still have their warning and weren't force-included
        // (user can dismiss the warning to include anyway — _duplicateWarning is cleared on dismiss)
        if (e._duplicateWarning) continue

        await supabase.from('exams').insert({
          user_id:       user.id,
          subject_id:    e.subject_id,
          title:         e.title,
          exam_date:     e.exam_date ?? new Date().toISOString().split('T')[0],
          exam_time:     e.exam_time,
          location:      e.location,
          notes:         e.notes,
          activity_type: e.activity_type,
          percentage:    e.percentage,
          grade:         null,
        })
        saved++
      }
      setSavedCount(saved)
      setStep('done')
    } catch {
      setParseError(t('Error al guardar. Intenta de nuevo.', 'Save error. Try again.'))
      setStep('review')
    }
  }

  const reset = () => {
    setStep('input'); setImageFile(null); setImagePreview(null)
    setTextInput(''); setParseError(''); setEvals([])
  }

  const activityColors: Record<ActivityType, string> = {
    exam:          'var(--danger)',
    workshop:      'var(--warning)',
    activity:      'var(--color-tertiary-container)',
    task:          'var(--color-primary)',
    study_session: 'var(--success)',
  }

  /* ─── STEP: input ─────────────────────────────────────────────────────── */
  if (step === 'input') return (
    <div className="space-y-4">
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
        className="hidden" onChange={handleFileChange} />

      <div className="rounded-2xl p-5 space-y-4"
        style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}>
        <p className="text-sm" style={{ color: 'var(--color-outline)' }}>
          {t(
            'Sube la foto de tu plan de evaluación o pega el texto. La IA extrae cada evaluación para que revises antes de guardar.',
            'Upload a photo of your evaluation plan or paste the text. AI extracts each evaluation for you to review before saving.'
          )}
        </p>

        {/* Input mode toggle */}
        <div className="flex gap-1 p-1 rounded-xl self-start" style={{ backgroundColor: 'var(--s-base)' }}>
          {(['image', 'text'] as InputMode[]).map(mode => (
            <button key={mode} onClick={() => { setInputMode(mode); setParseError('') }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
              style={{
                backgroundColor: inputMode === mode ? 'var(--s-high)' : 'transparent',
                color: inputMode === mode ? 'var(--on-surface)' : 'var(--color-outline)',
              }}>
              <span className="material-symbols-outlined text-[14px]">
                {mode === 'image' ? 'photo_camera' : 'text_fields'}
              </span>
              {mode === 'image' ? t('Imagen', 'Image') : t('Texto', 'Text')}
            </button>
          ))}
        </div>

        {/* Image input */}
        {inputMode === 'image' && (
          !imagePreview ? (
            <button onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-2xl border-2 border-dashed py-10 flex flex-col items-center gap-3 transition-all hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5"
              style={{ borderColor: 'var(--border-default)', color: 'var(--color-outline)' }}>
              <span className="material-symbols-outlined text-[36px]">add_photo_alternate</span>
              <span className="text-sm font-semibold">{t('Toca para subir imagen', 'Tap to upload image')}</span>
              <span className="text-xs opacity-60">JPG · PNG · WEBP · máx 10 MB</span>
            </button>
          ) : (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden">
                <img src={imagePreview} alt="preview" className="w-full max-h-56 object-contain rounded-xl"
                  style={{ backgroundColor: 'var(--s-base)' }} />
                <button onClick={() => { setImageFile(null); setImagePreview(null); setParseError('') }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110"
                  style={{ backgroundColor: 'var(--s-high)', color: 'var(--color-outline)' }}>
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            </div>
          )
        )}

        {/* Text input */}
        {inputMode === 'text' && (
          <textarea
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            className="input w-full text-sm resize-none"
            rows={8}
            placeholder={t(
              'Pega aquí el texto de tu plan de evaluaciones, cronograma o syllabus…',
              'Paste your evaluation plan, schedule or syllabus text here…'
            )}
          />
        )}

        {/* Analyze button */}
        {((inputMode === 'image' && imagePreview) || (inputMode === 'text' && textInput.trim())) && (
          <button onClick={handleParse} className="btn-primary w-full flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            {t('Analizar con IA', 'Analyze with AI')}
          </button>
        )}

        {parseError && (
          <p className="text-xs px-3 py-2.5 rounded-xl"
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
          {t('Extrayendo evaluaciones…', 'Extracting evaluations…')}
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--color-outline)' }}>
          {t('La IA está identificando fechas, porcentajes y tipos', 'AI is identifying dates, percentages and types')}
        </p>
      </div>
    </div>
  )

  /* ─── STEP: review ────────────────────────────────────────────────────── */
  if (step === 'review') {
    const includedCount = evals.filter(e => e._included && !e._duplicateWarning).length
    const dupCount      = evals.filter(e => e._duplicateWarning).length

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="rounded-2xl px-5 py-4 space-y-3"
          style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-tertiary) 12%, transparent)' }}>
              <span className="material-symbols-outlined text-[18px]"
                style={{ color: 'var(--color-tertiary)', fontVariationSettings: "'FILL' 1" }}>
                assignment
              </span>
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color: 'var(--on-surface)' }}>
                {evals.length} {t('evaluación(es) detectada(s)', 'evaluation(s) detected')}
              </p>
              <p className="text-xs" style={{ color: 'var(--color-outline)' }}>
                {t('Revisa y corrige. Los campos son editables.', 'Review and correct. All fields are editable.')}
              </p>
            </div>
          </div>
          {dupCount > 0 && (
            <div className="flex items-start gap-2 text-xs px-3 py-2.5 rounded-xl"
              style={{ backgroundColor: 'color-mix(in srgb, var(--warning) 10%, transparent)', color: 'var(--warning)' }}>
              <span className="material-symbols-outlined text-[14px] flex-shrink-0 mt-0.5">warning</span>
              <span>
                {t(
                  `${dupCount} evaluación(es) ya existen en el sistema y están marcadas. Puedes incluirlas de todas formas tocando el botón de advertencia.`,
                  `${dupCount} evaluation(s) already exist and are flagged. You can still include them by tapping the warning button.`
                )}
              </span>
            </div>
          )}
        </div>

        {/* Evaluation cards */}
        {evals.map(ev => {
          const typeInfo = ACTIVITY_TYPES[ev.activity_type]
          const typeColor = activityColors[ev.activity_type]
          return (
            <div key={ev._key} className="rounded-2xl overflow-hidden transition-opacity"
              style={{
                border: ev._duplicateWarning
                  ? '1px solid color-mix(in srgb, var(--warning) 40%, transparent)'
                  : '1px solid var(--border-subtle)',
                opacity: ev._included ? 1 : 0.45,
              }}>

              {/* Card header */}
              <div className="px-4 pt-4 pb-3 flex items-start gap-3"
                style={{ backgroundColor: `color-mix(in srgb, ${typeColor} 5%, var(--s-low))` }}>

                {/* Type icon */}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: `color-mix(in srgb, ${typeColor} 15%, transparent)` }}>
                  <span className="material-symbols-outlined text-[18px]"
                    style={{ color: typeColor, fontVariationSettings: "'FILL' 1" }}>
                    {typeInfo.icon}
                  </span>
                </div>

                {/* Title */}
                <input
                  value={ev.title}
                  onChange={e => patchEval(ev._key, { title: e.target.value })}
                  className="input flex-1 text-sm font-bold py-1.5 min-w-0"
                  placeholder={t('Nombre de la evaluación', 'Evaluation name')}
                />

                {/* Duplicate warning / Include toggle */}
                {ev._duplicateWarning ? (
                  <button
                    onClick={() => patchEval(ev._key, { _duplicateWarning: false })}
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-all hover:scale-110"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--warning) 15%, transparent)', color: 'var(--warning)' }}
                    title={t('Ya existe. Toca para incluir de todas formas', 'Already exists. Tap to include anyway')}>
                    <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      warning
                    </span>
                  </button>
                ) : (
                  <button
                    onClick={() => patchEval(ev._key, { _included: !ev._included })}
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-all"
                    style={{
                      backgroundColor: ev._included ? `color-mix(in srgb, ${typeColor} 15%, transparent)` : 'var(--s-base)',
                      color: ev._included ? typeColor : 'var(--color-outline)',
                    }}>
                    <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {ev._included ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                  </button>
                )}
              </div>

              {/* Fields */}
              <div className="px-4 pb-4 pt-3 space-y-3" style={{ backgroundColor: 'var(--s-base)' }}>

                {/* Subject + Activity type row */}
                <div className="flex gap-2 flex-wrap items-start">
                  <div className="flex-1 min-w-[160px]">
                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-outline)' }}>
                      {t('Materia', 'Subject')}
                    </p>
                    <select
                      value={ev.subject_id ?? ''}
                      onChange={e => patchEval(ev._key, { subject_id: e.target.value || null })}
                      className="input text-xs py-1.5 w-full">
                      <option value="">{t('Sin materia', 'No subject')}</option>
                      {subjects.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1 min-w-[160px]">
                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-outline)' }}>
                      {t('Tipo', 'Type')}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {(Object.keys(ACTIVITY_TYPES) as ActivityType[]).map(type => {
                        const info  = ACTIVITY_TYPES[type]
                        const color = activityColors[type]
                        const active = ev.activity_type === type
                        return (
                          <button key={type} onClick={() => patchEval(ev._key, { activity_type: type })}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all"
                            style={{
                              backgroundColor: active ? `color-mix(in srgb, ${color} 15%, transparent)` : 'var(--s-low)',
                              color: active ? color : 'var(--color-outline)',
                              border: active ? `1px solid color-mix(in srgb, ${color} 30%, transparent)` : '1px solid transparent',
                            }}
                            title={language === 'es' ? info.label_es : info.label_en}>
                            <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                              {info.icon}
                            </span>
                            <span className="hidden sm:inline">
                              {language === 'es' ? info.label_es : info.label_en}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Date + Time + Percentage row */}
                <div className="flex gap-2 flex-wrap">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-outline)' }}>
                      {t('Fecha', 'Date')}
                    </p>
                    <input type="date" value={ev.exam_date ?? ''}
                      onChange={e => patchEval(ev._key, { exam_date: e.target.value || null })}
                      className="input text-xs py-1.5" style={{ width: '140px' }} />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-outline)' }}>
                      {t('Hora', 'Time')}
                    </p>
                    <input type="time" value={ev.exam_time ?? ''}
                      onChange={e => patchEval(ev._key, { exam_time: e.target.value || null })}
                      className="input text-xs py-1.5" style={{ width: '104px' }} />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-outline)' }}>
                      {t('Peso (%)', 'Weight (%)')}
                    </p>
                    <input type="number" min={0} max={100}
                      value={ev.percentage ?? ''}
                      onChange={e => patchEval(ev._key, { percentage: e.target.value ? Number(e.target.value) : null })}
                      className="input text-xs py-1.5" style={{ width: '72px' }}
                      placeholder="—" />
                  </div>
                  <div className="flex-1 min-w-[100px]">
                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-outline)' }}>
                      {t('Lugar', 'Location')}
                    </p>
                    <input value={ev.location ?? ''}
                      onChange={e => patchEval(ev._key, { location: e.target.value || null })}
                      className="input text-xs py-1.5 w-full"
                      placeholder={t('Aula, plataforma…', 'Room, platform…')} />
                  </div>
                </div>

              </div>
            </div>
          )
        })}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button onClick={reset} className="btn-secondary flex-1">
            {t('Cancelar', 'Cancel')}
          </button>
          <button onClick={handleSave} disabled={includedCount === 0}
            className="btn-primary flex-1"
            style={{ opacity: includedCount === 0 ? 0.5 : 1 }}>
            {t(`Guardar ${includedCount}`, `Save ${includedCount}`)}
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
          {t(`${savedCount} evaluación(es) registrada(s)`, `${savedCount} evaluation(s) saved`)}
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--color-outline)' }}>
          {t('Ya aparecen en tu Planner.', 'They now appear in your Planner.')}
        </p>
      </div>
      <div className="flex gap-3">
        <a href="/planner" className="btn-primary flex items-center gap-2 text-sm">
          <span className="material-symbols-outlined text-[16px]">checklist</span>
          {t('Ver Planner', 'View Planner')}
        </a>
      </div>
      <button onClick={() => { reset(); onDone() }}
        className="text-xs transition-all hover:opacity-70" style={{ color: 'var(--color-outline)' }}>
        {t('Importar otro plan', 'Import another plan')}
      </button>
    </div>
  )
}
