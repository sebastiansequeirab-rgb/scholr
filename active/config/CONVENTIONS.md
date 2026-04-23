# Conventions — Skolar

## AI Provider (IMPORTANT)
Current: Groq — llama-3.3-70b via GROQ_API_KEY
Target: Claude API — claude-sonnet-4-5 via ANTHROPIC_API_KEY

Migration path: use AI_PROVIDER env var to switch between providers.
Build all new AI features with both code paths ready.

```typescript
// In .env.local
AI_PROVIDER=groq          // current
// AI_PROVIDER=claude     // future — just change this line to migrate

// In AI route handler
const provider = process.env.AI_PROVIDER || 'groq'

if (provider === 'claude') {
  // Anthropic SDK
  model: 'claude-sonnet-4-5'
  // image format: { type: 'image', source: { type: 'base64', ... } }
} else {
  // Groq SDK
  model: 'llama-3.3-70b-versatile'
  // image format: { type: 'image_url', image_url: { url: 'data:...' } }
}
```

## TypeScript
- NEVER use `any` — use specific types or `unknown`
- Component props: `interface ComponentNameProps {}`
- DB types: define in /types/database.ts

## Supabase
```typescript
// Browser
import { createClient } from '@/lib/supabase/client'
// Server
import { createClient } from '@/lib/supabase/server'

// ALWAYS filter by user_id (RLS is ON everywhere)
.eq('user_id', user.id)

// Realtime — always clean up in useEffect return
return () => { supabase.removeChannel(channel) }
```

## ENV variables (current)
```
NEXT_PUBLIC_SUPABASE_URL=https://xawgomhknzdnhkxcegqi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon key]
SUPABASE_SECRET_KEY=[service role key]   ← note: named SECRET_KEY not SERVICE_ROLE_KEY
GROQ_API_KEY=[groq key]                  ← current AI provider
AI_PROVIDER=groq                         ← add this for migration readiness
# ANTHROPIC_API_KEY=[claude key]         ← uncomment when migrating to Claude
```

## i18n — mandatory
- ALWAYS add to BOTH /i18n/es.json AND /i18n/en.json
- NEVER hardcode visible strings in components
- Key format: `section.subsection.key`

## Styling
- CSS variables: `var(--color-primary)`, `var(--s-base)`, `var(--border-subtle)`
- NEVER hardcode hex colors
- Dark theme is default
- Mobile-first: base styles for mobile, md: lg: for desktop

## File naming
- Components: PascalCase.tsx
- Hooks: useFeatureName.ts
- Utilities: kebab-case.ts

## Commits
```
feat: add voice input to notes toolbar
fix: progress bar calculation in subjects page
ui: update subject card layout
db: add access_code column to subjects
refactor: move grade utils to lib/utils/grade.ts
security: fix SECURITY DEFINER on upcoming_exams view
ai: add image analysis support to chat
migrate: switch AI provider from groq to claude
```
