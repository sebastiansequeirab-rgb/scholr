/** Curated Material Symbols for the course icon picker. */
export const COURSE_ICONS = [
  'menu_book', 'school', 'calculate', 'functions', 'science', 'biotech', 'public', 'history_edu',
  'translate', 'auto_stories', 'palette', 'music_note', 'piano', 'sports_basketball', 'theater_comedy',
  'code', 'terminal', 'memory', 'data_object', 'analytics', 'bar_chart', 'show_chart', 'table_chart',
  'design_services', 'architecture', 'engineering', 'precision_manufacturing', 'psychology', 'gavel',
  'medical_services', 'restaurant', 'agriculture', 'forest',
] as const

export type CourseIcon = (typeof COURSE_ICONS)[number]
