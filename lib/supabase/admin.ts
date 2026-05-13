import { createClient } from '@supabase/supabase-js'

/**
 * Supabase admin client using the service_role key.
 * Bypasses Row Level Security — only use in server-side code (API routes, Server Components).
 * Never import this in client components.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) is not set')
  return createClient(url, serviceKey)
}
