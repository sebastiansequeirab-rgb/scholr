/** Map a mime type or filename to a Material Symbol icon name + family label. */

type MimeMatch = { test: (mime: string, name: string) => boolean; icon: string; label: string }

const MATCHERS: MimeMatch[] = [
  { test: (m) => m === 'application/pdf',                                          icon: 'picture_as_pdf', label: 'PDF'   },
  { test: (m) => m.startsWith('image/'),                                            icon: 'image',          label: 'Imagen' },
  { test: (m) => m.startsWith('video/'),                                            icon: 'movie',          label: 'Video' },
  { test: (m) => m.startsWith('audio/'),                                            icon: 'audiotrack',     label: 'Audio' },
  { test: (m) => /sheet|excel|csv/.test(m),                                          icon: 'table_chart',    label: 'Hoja'  },
  { test: (m) => /presentation|powerpoint/.test(m),                                  icon: 'slideshow',      label: 'Slides' },
  { test: (m) => /msword|wordprocessingml|opendocument\.text/.test(m),               icon: 'description',    label: 'Doc'   },
  { test: (m) => m.startsWith('text/') || /markdown/.test(m),                        icon: 'text_snippet',   label: 'Texto' },
  { test: (m) => /zip|x-tar|x-rar|x-7z|compressed/.test(m),                          icon: 'folder_zip',     label: 'Archivo' },
]

const EXT_FALLBACK: Record<string, { icon: string; label: string }> = {
  pdf:  { icon: 'picture_as_pdf', label: 'PDF' },
  doc:  { icon: 'description',    label: 'Doc' },
  docx: { icon: 'description',    label: 'Doc' },
  xls:  { icon: 'table_chart',    label: 'Hoja' },
  xlsx: { icon: 'table_chart',    label: 'Hoja' },
  csv:  { icon: 'table_chart',    label: 'CSV' },
  ppt:  { icon: 'slideshow',      label: 'Slides' },
  pptx: { icon: 'slideshow',      label: 'Slides' },
  txt:  { icon: 'text_snippet',   label: 'Texto' },
  md:   { icon: 'text_snippet',   label: 'Markdown' },
  zip:  { icon: 'folder_zip',     label: 'Archivo' },
}

export function fileIcon(mime: string | null | undefined, name: string = ''): { icon: string; label: string } {
  const m = (mime || '').toLowerCase()
  for (const matcher of MATCHERS) {
    if (matcher.test(m, name)) return { icon: matcher.icon, label: matcher.label }
  }
  const ext = name.toLowerCase().split('.').pop() || ''
  return EXT_FALLBACK[ext] || { icon: 'insert_drive_file', label: 'Archivo' }
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let n = bytes
  let i = 0
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++ }
  return `${n.toFixed(n >= 100 || i === 0 ? 0 : 1)} ${units[i]}`
}
