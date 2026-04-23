import { createClient } from '@supabase/supabase-js'

/**
 * Service-role client — bypasses RLS.
 * Use only in server-side API routes for privileged lookups.
 * Never expose to the browser.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  )
}
