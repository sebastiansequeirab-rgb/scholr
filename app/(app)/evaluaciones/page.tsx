'use client'

import { useState } from 'react'
import { useTranslation } from '@/hooks/useTranslation'
import { subjectTag } from '@/lib/utils'
import { DashMetaBar } from '@/features/home/components/DashMetaBar'
import { SideDrawer } from '@/components/ui/SideDrawer'
import { MOCK_EVALS, type MockEval } from '@/features/evaluaciones/data/mocks'

function EvalDrawerBody({ ev }: { ev: MockEval }) {
  const { t } = useTranslation()
  const tagClass = subjectTag(ev.subjectColor)
  const weightLabel = t('evaluaciones.weightLabel').replace('{n}', String(ev.weight))
  const countdownClass =
    ev.countdownTone === 'danger'  ? 'drawer-meta__value is-mono' :
    ev.countdownTone === 'warning' ? 'drawer-meta__value is-mono' :
                                     'drawer-meta__value is-mono'
  const countdownColor =
    ev.countdownTone === 'danger'  ? 'var(--danger)' :
    ev.countdownTone === 'warning' ? 'var(--warning)' :
                                     'var(--on-surface)'

  return (
    <div className={tagClass}>
      <div className="drawer-chips">
        <span className="subj-chip">{ev.subjectCode}</span>
        <span className="tipo-chip">{ev.type}</span>
        <span className="pct-chip">{weightLabel}</span>
      </div>

      <div className="drawer-section">
        <div className="drawer-section__label">{t('drawer.detail')}</div>
        <div className="drawer-meta">
          <div className="drawer-meta__row">
            <span className="drawer-meta__label">{t('drawer.subject')}</span>
            <span className="drawer-meta__value is-mono">{ev.subjectCode}</span>
          </div>
          <div className="drawer-meta__row">
            <span className="drawer-meta__label">{t('drawer.type')}</span>
            <span className="drawer-meta__value is-mono">{ev.type}</span>
          </div>
          <div className="drawer-meta__row">
            <span className="drawer-meta__label">{t('drawer.weight')}</span>
            <span className="drawer-meta__value is-mono">{ev.weight}%</span>
          </div>
          <div className="drawer-meta__row">
            <span className="drawer-meta__label">{t('drawer.date')}</span>
            <span className="drawer-meta__value is-mono">{ev.day} {ev.month}</span>
          </div>
          <div className="drawer-meta__row">
            <span className="drawer-meta__label">{t('drawer.time')}</span>
            <span className="drawer-meta__value is-mono">{ev.time}</span>
          </div>
          <div className="drawer-meta__row">
            <span className="drawer-meta__label">{t('drawer.location')}</span>
            <span className="drawer-meta__value">{ev.location}</span>
          </div>
          <div className="drawer-meta__row">
            <span className="drawer-meta__label">{t('drawer.countdown')}</span>
            <span className={countdownClass} style={{ color: countdownColor }}>{ev.countdown}</span>
          </div>
        </div>
      </div>

      <div className="drawer-section">
        <div className="drawer-progress-row" style={{ marginBottom: 6 }}>
          <span className="drawer-section__label" style={{ marginBottom: 0 }}>{t('drawer.preparation')}</span>
          <span style={{ color: 'var(--on-surface)' }}>{ev.prep}%</span>
        </div>
        <div className="drawer-progress" aria-hidden>
          <div className="drawer-progress__fill" style={{ width: `${ev.prep}%` }} />
        </div>
      </div>

      <div className="drawer-actions">
        <button type="button" className="btn btn-primary">
          <span className="material-symbols-outlined">menu_book</span>
          {t('drawer.openGuide')}
        </button>
        <button type="button" className="btn btn-secondary">
          <span className="material-symbols-outlined">edit</span>
          {t('drawer.edit')}
        </button>
      </div>
    </div>
  )
}

function DayBlock({ ev }: { ev: MockEval }) {
  const { t } = useTranslation()
  const subText =
    ev.subKey === 'today'    ? t('evaluaciones.day.today') :
    ev.subKey === 'tomorrow' ? t('evaluaciones.day.tomorrow') :
    t('evaluaciones.day.daysCount').replace('{n}', String(ev.daysCount ?? 0))

  return (
    <div className="day-block">
      <div className="day-block__num-row">
        <span className="day-block__num">{ev.day}</span>
        <span className={`day-block__dot is-${ev.urgency}`} aria-hidden />
      </div>
      <div className="day-block__mo">{ev.month}</div>
      <div
        className={`day-block__sub${
          ev.urgency === 'today' ? ' is-today' :
          ev.urgency === 'tomorrow' ? ' is-tomorrow' : ''
        }`}
      >
        {subText}
      </div>
    </div>
  )
}

function EvalRow({ ev, onOpen }: { ev: MockEval; onOpen: (id: string) => void }) {
  const { t } = useTranslation()
  const tagClass = subjectTag(ev.subjectColor)
  const weightLabel = t('evaluaciones.weightLabel').replace('{n}', String(ev.weight))
  const countdownClass =
    ev.countdownTone === 'danger'  ? 'countdown is-danger' :
    ev.countdownTone === 'warning' ? 'countdown is-warning' :
    'countdown'

  return (
    <div className="timeline-row">
      <DayBlock ev={ev} />

      <div
        className={`eval-card ${tagClass}`}
        role="button"
        tabIndex={0}
        onClick={() => onOpen(ev.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onOpen(ev.id)
          }
        }}
      >
        <div className="eval-card__head">
          <span className="subj-chip">{ev.subjectCode}</span>
          <span className="tipo-chip">{ev.type}</span>
          <span className="pct-chip">{weightLabel}</span>
        </div>

        <div className="eval-card__title">{ev.title}</div>

        <div className="eval-card__meta">
          <span className="eval-card__meta-item">
            <span className="material-symbols-outlined">schedule</span>
            {ev.time}
          </span>
          <span className="eval-card__meta-item">
            <span className="material-symbols-outlined">place</span>
            {ev.location}
          </span>
        </div>

        <div className="eval-card__prep-row">
          <span className="eval-card__prep-label">{t('evaluaciones.preparation')}</span>
          <span className="eval-card__prep-pct">{ev.prep}%</span>
        </div>
        <div className="eval-card__bar" aria-hidden>
          <div className="eval-card__bar-fill" style={{ width: `${ev.prep}%` }} />
        </div>

        <button
          type="button"
          className="eval-card__guide"
          onClick={(e) => { e.stopPropagation(); /* eslint-disable-next-line no-console */ console.log('[eval] guide', ev.id) }}
        >
          {t('evaluaciones.openGuide')}
          <span className="material-symbols-outlined">north_east</span>
        </button>
      </div>

      <div className={countdownClass}>{ev.countdown}</div>
    </div>
  )
}

export default function EvaluacionesPage() {
  const { t } = useTranslation()
  const [drawerId, setDrawerId] = useState<string | null>(null)

  const counts = {
    total: MOCK_EVALS.length,
    urgent: MOCK_EVALS.filter(e => e.urgency === 'today').length,
    week: MOCK_EVALS.filter(e =>
      e.urgency === 'today' || e.urgency === 'tomorrow' || (e.urgency === 'soon' && (e.daysCount ?? 99) <= 7)
    ).length,
  }
  const sub = t('evaluaciones.subTpl')
    .replace('{n}', String(counts.total))
    .replace('{urgent}', String(counts.urgent))
    .replace('{week}', String(counts.week))

  const openCard = (id: string) => {
    // eslint-disable-next-line no-console
    console.log('[eval] open', id)
    setDrawerId(id)
  }

  const drawerEval = drawerId ? MOCK_EVALS.find(e => e.id === drawerId) : null

  return (
    <div className="max-w-[1240px] mx-auto reveal-stagger">
      <DashMetaBar
        weekIndex={17}
        weekTotal={20}
        avg={13.6}
        alertDueLabel="1 entrega cierra en 4h 34m"
      />

      <header className="screen-head" style={{ marginTop: 14 }}>
        <div className="screen-head__left">
          <span className="kicker">{t('evaluaciones.eyebrow')}</span>
          <h1 className="screen-head__title">
            {t('evaluaciones.titleA')} <span className="serif">{t('evaluaciones.titleSerif')}</span>
          </h1>
          <p className="screen-head__sub">{sub}</p>
        </div>

        <div className="screen-head__actions">
          <button type="button" className="btn btn-secondary">
            <span className="material-symbols-outlined">tune</span>
            {t('evaluaciones.filter')}
          </button>
          <button type="button" className="btn-new">
            <span className="material-symbols-outlined">add</span>
            {t('evaluaciones.add')}
          </button>
        </div>
      </header>

      <section className="timeline">
        {MOCK_EVALS.map(ev => (
          <EvalRow key={ev.id} ev={ev} onOpen={openCard} />
        ))}
      </section>

      <SideDrawer
        open={!!drawerId}
        onClose={() => setDrawerId(null)}
        kicker={t('drawer.detail')}
        title={drawerEval ? drawerEval.title : (drawerId ?? '')}
      >
        {drawerEval ? (
          <EvalDrawerBody ev={drawerEval} />
        ) : (
          <p className="side-drawer__placeholder">
            {t('drawer.placeholder').replace('{id}', drawerId || '')}
          </p>
        )}
      </SideDrawer>
    </div>
  )
}
