import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/components/layout/Providers'

export const metadata: Metadata = {
  title: 'Skolar — Tu productividad académica',
  description: 'La herramienta todo-en-uno para estudiantes. Gestiona materias, tareas, exámenes y notas.',
  icons: {
    icon: '/logo-dark.png',
    apple: '/logo-dark.png',
  },
  openGraph: {
    title: 'Skolar — Tu productividad académica',
    description: 'La herramienta todo-en-uno para estudiantes. Gestiona materias, tareas, exámenes y notas.',
    images: [{ url: '/logo-dark.png', width: 1200, height: 630, alt: 'Skolar' }],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
