import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { SidebarCollapseProvider } from '@/components/layout/SidebarCollapseContext'
import type { Profile } from '@/types'

export default async function AppLayout({
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

  const theme = (profile as Profile | null)?.theme || 'indigo'

  return (
    <SidebarCollapseProvider>
      <div data-theme={theme}>
        <Sidebar profile={profile as Profile | null} />

        {/* Main content — sidebar-offset class reacts to body[data-sidebar] via globals.css */}
        <div className="sidebar-offset">
          {/* Mobile top bar offset */}
          <div className="pt-14 lg:pt-0" />

          <main className="min-h-screen p-4 pb-20 lg:pb-8 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </SidebarCollapseProvider>
  )
}
