import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { AppSidebarShell } from '@/components/layout/AppSidebarShell'
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
  const collapsed = cookies().get('student_sidebar_collapsed')?.value === '1'

  return (
    <div data-theme={theme}>
      <AppSidebarShell initialCollapsed={collapsed}>
        <Sidebar profile={profile as Profile | null} />

        {/* Mobile top bar offset (h-12 = 48px) */}
        <div className="pt-12 lg:pt-0" />

        {/* Desktop topbar */}
        <Topbar />

        <main className="min-h-screen px-4 pt-4 pb-24 lg:pb-10 lg:px-6 lg:pt-5">
          <div className="max-w-[1240px] mx-auto">
            {children}
          </div>
        </main>
      </AppSidebarShell>
    </div>
  )
}
