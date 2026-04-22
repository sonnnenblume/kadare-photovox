import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY が設定されていません' }, { status: 500 })
  }

  const { audioUrl } = await req.json()
  if (!audioUrl) return NextResponse.json({ error: 'audioUrl required' }, { status: 400 })

  const audioRes = await fetch(audioUrl)
  if (!audioRes.ok) {
    return NextResponse.json({ error: `音声ファイルの取得に失敗しました (${audioRes.status})` }, { status: 502 })
  }

  const audioBuffer = await audioRes.arrayBuffer()
  const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' })

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
