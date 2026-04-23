/**
 * Generates an access code in the format: PREFIX-YEAR-SUFFIX
 * Example: MAT-2026-XK3
 */
export function generateAccessCode(subjectName: string): string {
  const prefix = subjectName
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 3)
    .padEnd(3, 'X')
  const year = new Date().getFullYear()
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase()
  return `${prefix}-${year}-${suffix}`
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
