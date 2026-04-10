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
        className="absolute top-14 left-0 z-50 p-3 rounded-2xl shadow-2xl animate-slide-up"
        style={{
          backgroundColor: 'var(--s-high)',
          border: '1px solid var(--border-strong)',
          boxShadow: '0 20px 60px var(--overlay-bg)',
          width: '220px',
        }}
      >
        <p className="mono text-[10px] uppercase tracking-widest mb-2.5 px-1" style={{ color: 'var(--color-outline)' }}>
          Elegir ícono
        </p>
        <div className="grid grid-cols-6 gap-1">
          {ICONS.map(icon => {
            const isSelected = currentIcon === icon
            return (
              <button
                key={icon}
                onClick={() => { onSelect(icon); onClose() }}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150 hover:scale-110"
                style={{
                  backgroundColor: isSelected
                    ? `color-mix(in srgb, ${subjectColor} 20%, transparent)`
                    : 'transparent',
                  outline: isSelected ? `2px solid ${subjectColor}60` : 'none',
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
