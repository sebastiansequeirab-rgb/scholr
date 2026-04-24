import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string; numpages: number }>

const MAX_TEXT_CHARS = 40_000 // ~10k tokens — enough for most academic docs

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (file.type !== 'application/pdf') return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await pdfParse(buffer)
    const text = result.text.slice(0, MAX_TEXT_CHARS).trim()

    if (!text) return NextResponse.json({ error: 'Could not extract text from PDF' }, { status: 422 })

    return NextResponse.json({ text, pages: result.numpages })
  } catch (err) {
    console.error('[parse-pdf]', err)
    return NextResponse.json({ error: 'Failed to parse PDF' }, { status: 500 })
  }
}
