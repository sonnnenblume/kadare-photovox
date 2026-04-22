import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY が設定されていません' }, { status: 500 })
  }

  const reqBody = await req.json().catch(() => null)
  const { audioPath, audioUrl } = reqBody ?? {}
  const rawPath: string = audioPath || audioUrl
  if (!rawPath) return NextResponse.json({ error: 'audioPath required' }, { status: 400 })

  const fileName = rawPath.split('/').pop() ?? rawPath
  const { data, error } = await supabase.storage.from('photos').download(fileName)
  if (error || !data) {
    return NextResponse.json({ error: `音声ファイルの取得に失敗しました: ${error?.message}` }, { status: 502 })
  }

  const audioBlob = new Blob([await data.arrayBuffer()], { type: 'audio/webm' })

  const form = new FormData()
  form.append('file', audioBlob, 'audio.webm')
  form.append('model', 'whisper-1')
  form.append('language', 'ja')

  const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  })

  const body = await whisperRes.json()
  if (!whisperRes.ok) {
    return NextResponse.json({ error: `Whisper エラー: ${body?.error?.message ?? whisperRes.status}` }, { status: whisperRes.status })
  }

  return NextResponse.json({ text: body.text })
}
