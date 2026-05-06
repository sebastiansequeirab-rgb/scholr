'use client'

const ICONS = [
  'menu_book', 'calculate', 'science', 'biotech',
  'code', 'palette', 'translate', 'history_edu',
  'fitness_center', 'trending_up', 'business_center', 'engineering',
  'music_note', 'gavel', 'architecture', 'medical_services',
  'lab_research', 'public', 'speed', 'view_in_ar',
  'electrical_services', 'psychology', 'computer', 'draw',
]

interface IconPickerProps {
  currentIcon: string | null
  subjectColor: string
  onSelect: (icon: string) => void
  onClose: () => void
}

export function IconPicker({ currentIcon, subjectColor, onSelect, onClose }: IconPickerProps) {
  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Picker popover */}
      <div
        className="absolute top-14 left-0 z-50 p-3 animate-slide-up"
        style={{
          backgroundColor: 'var(--s-high)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: '0 20px 60px var(--overlay-bg)',
          width: '236px',
        }}
      >
        <div className="flex items-center justify-between mb-2.5 px-1">
          <span className="kicker">Elegir ícono</span>
          <span className="mono text-[9px]" style={{ color: 'var(--color-outline)', letterSpacing: '0.06em' }}>
            {ICONS.length}
          </span>
        </div>
        <div className="grid grid-cols-6 gap-1">
          {ICONS.map(icon => {
            const isSelected = currentIcon === icon
            return (
              <button
                key={icon}
                onClick={() => { onSelect(icon); onClose() }}
                className="w-9 h-9 flex items-center justify-center transition-all duration-150 hover:scale-110"
                style={{
                  backgroundColor: isSelected
                    ? `color-mix(in srgb, ${subjectColor} 18%, transparent)`
                    : 'transparent',
                  borderRadius: 'var(--radius)',
                  outline: isSelected ? `1.5px solid color-mix(in srgb, ${subjectColor} 45%, transparent)` : 'none',
                  outlineOffset: '-1px',
                }}
                title={icon}
              >
                <span
                  className="material-symbols-outlined text-[18px]"
                  style={{
                    color: isSelected ? subjectColor : 'var(--color-outline)',
                    fontVariationSettings: isSelected ? "'FILL' 1" : "'FILL' 0",
                  }}
                >
                  {icon}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
