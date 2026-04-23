import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TeacherSidebar } from '@/features/teacher/layout/TeacherSidebar'
import { SidebarCollapseProvider } from '@/components/layout/SidebarCollapseContext'
import type { Profile } from '@/types'

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if ((profile as Profile | null)?.role !== 'teacher') {
    redirect('/dashboard')
  }

  const theme = (profile as Profile | null)?.theme || 'indigo'

  return (
    <SidebarCollapseProvider>
      <div data-theme={theme}>
        <TeacherSidebar profile={profile as Profile | null} />

        <div className="sidebar-offset">
          <div className="pt-14 lg:pt-0" />
          <main className="min-h-screen p-4 pb-20 lg:pb-8 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </SidebarCollapseProvider>
  )
}
