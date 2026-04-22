export const SUBJECT_ICON_MAP: [RegExp, string][] = [
  [/matemátic|matemati|cálculo|calculo|álgebra|algebra|estadístic|estadistic/i, 'calculate'],
  [/física|fisica|mecánica|mecanica/i, 'speed'],
  [/química|quimica/i, 'science'],
  [/biología|biologia|biotec/i, 'biotech'],
  [/historia|social|política|politica|cultura/i, 'history_edu'],
  [/geografía|geografia/i, 'public'],
  [/lengua|literatura|español|inglés|ingles|idioma|comunicación|comunicacion/i, 'translate'],
  [/programación|programacion|código|codigo|software|sistemas|computación|computacion/i, 'code'],
  [/diseño|diseñ|arte|dibujo/i, 'palette'],
  [/música|musica/i, 'music_note'],
  [/educación física|educacion fisica|deporte|gym/i, 'fitness_center'],
  [/economía|economia|finanzas|financier|contabilidad|trading/i, 'trending_up'],
  [/administración|administracion|empresa|gestión|gestion|marketing/i, 'business_center'],
  [/ingeniería|ingenieria|manufactura|industrial|almacenamiento|proceso/i, 'engineering'],
  [/modelado|modelo.?3d|3d/i, 'view_in_ar'],
  [/instalacion|eléctric|electric|auxiliar/i, 'electrical_services'],
  [/práctica|practica|taller|laboratorio/i, 'lab_research'],
  [/derecho|ley|legal|jurídic/i, 'gavel'],
  [/arquitectura/i, 'architecture'],
  [/medicina|salud|enfermería/i, 'medical_services'],
]

export function getSubjectIcon(name: string): string {
  for (const [pattern, icon] of SUBJECT_ICON_MAP) {
    if (pattern.test(name)) return icon
  }
  return 'menu_book'
}
