import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { audioUrl } = await req.json()
  if (!audioUrl) return NextResponse.json({ error: 'audioUrl required' }, { status: 400 })

  const audioRes = await fetch(audioUrl)
  if (!audioRes.ok) return NextResponse.json({ error: 'audio fetch failed' }, { status: 502 })
  const audioBlob = await audioRes.blob()

  const form = new FormData()
  form.append('file', audioBlob, 'audio.webm')
  form.append('model', 'whisper-1')
  form.append('language', 'ja')

  const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  })

  if (!whisperRes.ok) {
    const err = await whisperRes.text()
    return NextResponse.json({ error: err }, { status: whisperRes.status })
  }

  const { text } = await whisperRes.json()
  return NextResponse.json({ text })
}
