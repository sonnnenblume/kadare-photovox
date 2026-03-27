'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const GROUPS = ['GroupA','GroupB','GroupC','GroupD','GroupE','GroupF','GroupG','GroupH']

// 全角を半角に変換
const toHalfWidth = (str: string) => {
  return str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
}

export default function Home() {
  const [role, setRole] = useState<'student' | 'viewer' | 'teacher' | null>(null)
  const [userId, setUserId] = useState('')
  const [screen, setScreen] = useState<'home'|'upload'|'gallery'>('home')
  const [posts, setPosts] = useState<any[]>([])
  const [uploadGroup, setUploadGroup] = useState('')
  const [comment, setComment] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  useEffect(() => {
    const savedRole = sessionStorage.getItem('kadare_role') as any
    const savedId = sessionStorage.getItem('kadare_user_id')
    if (savedRole && savedId) { setRole(savedRole); setUserId(savedId); }
  }, [])

  useEffect(() => {
    if (screen === 'gallery' && role) loadPosts()
  }, [screen, role])

  // --- 【修正の核心】データ取得の条件を極限まで緩める ---
  async function loadPosts() {
    try {
      let query = supabase.from('posts').select('*').order('created_at', { ascending: false })
      
      if (role === 'teacher') {
        // 教員：全件表示（フィルタなし）
      } else if (role === 'viewer') {
        // 班(GroupAなど)でログイン：その班の投稿だけを表示
        query = query.eq('group_name', userId)
      } else {
        // 学生：トラブル防止のため、学生ログインでも「自分の投稿」だけでなく
        // 「自分が所属を選択して投稿した班」の投稿が見えるようにするか、
        // あるいはシンプルに「自分のID」でフィルタします。
        // ここでは最も安全な「自分のID一致」に戻します。
        query = query.eq('user_id', userId)
      }

      const { data, error } = await query
      if (error) throw error
      setPosts(data || [])
    } catch (e) {
      console.error(e)
      alert("読み込みに失敗しました。ネット接続を確認してください。")
    }
  }

  async function handleDelete(postId: string) {
    if (!confirm('この投稿を完全に削除しますか？')) return
    try {
      const { error } = await supabase.from('posts').delete().eq('id', postId)
      if (error) throw error
      alert('削除しました'); loadPosts();
    } catch (e: any) { alert('削除失敗: ' + e.message) }
  }

  function handleLogin() {
    const rawId = toHalfWidth(userId.trim());
    if (!rawId) return alert('学籍番号を入力してください')
    
    let userRole: 'student' | 'viewer' | 'teacher' = 'student'
    if (rawId === '0526') {
      userRole = 'teacher'
    } else if (GROUPS.some(g => g.toLowerCase() === rawId.toLowerCase())) {
      const matchedGroup = GROUPS.find(g => g.toLowerCase() === rawId.toLowerCase()) || rawId;
      userRole = 'viewer'
      setUserId(matchedGroup)
    } else {
      setUserId(rawId)
    }
    setRole(userRole)
    sessionStorage.setItem('kadare_role', userRole)
    sessionStorage.setItem('kadare_user_id', rawId)
  }

  // --- 録音・アップロード処理 ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const chunks: BlobPart[] = []
      recorder.ondataavailable = (e) => chunks.push(e.data)
      recorder.onstop = () => setAudioBlob(new Blob(chunks, { type: 'audio/m4a' }))
      recorder.start(); mediaRecorderRef.current = recorder; setIsRecording(true);
    } catch (e) { alert("マイクを許可してください") }
  }
  const stopRecording = () => { mediaRecorderRef.current?.stop(); setIsRecording(false); }

  async function handleUpload() {
    if (!uploadGroup) return alert('班を選択してください')
    if (!imageFile) return alert('写真を選択してください')
    setUploading(true)
    try {
      const imgName = `photo_${Date.now()}.jpg`
      const { error: upErr } = await supabase.storage.from('photos').upload(imgName, imageFile)
      if (upErr) throw upErr
      const photoUrl = `${supabaseUrl}/storage/v1/object/public/photos/${imgName}`
      let audioUrl = ""
      if (audioBlob) {
        const audName = `audio_${Date.now()}.m4a`
        await supabase.storage.from('photos').upload(audName, audioBlob)
        audioUrl = `${supabaseUrl}/storage/v1/object/public/photos/${audName}`
      }
      const { error: dbErr } = await supabase.from('posts').insert([{ 
        user_id: String(userId), group_name: String(uploadGroup),
        theme: String(comment || ""), photo_url: String(photoUrl), audio_url: audioUrl
      }])
      if (dbErr) throw dbErr
      alert('投稿完了！'); setComment(''); setImageFile(null); setAudioBlob(null); setScreen('gallery');
    } catch (e: any) { alert('エラー: ' + e.message) } finally { setUploading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', color: '#1c1e21', fontFamily: 'sans-serif' }}>
      <header style={{ background: '#000', padding: '15px 20px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 onClick={() => setScreen('home')} style={{ fontSize: '22px', margin: 0, cursor: 'pointer' }}>PhotoVox</h1>
        {role && <button onClick={() => { sessionStorage.clear(); location.reload(); }} style={{ background: 'transparent', color: '#fff', border: '1px solid #fff', borderRadius: '20px', padding: '5px 15px', fontSize: '12px' }}>ログアウト</button>}
      </header>

      <main style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
        {!role ? (
          <div style={{ textAlign: 'center', background: '#fff', padding: '40px 20px', borderRadius: '15px', marginTop: '40px' }}>
            <h2 style={{ marginBottom: '20px' }}>ログイン</h2>
            <input type="text" placeholder="学籍番号を入力してください" value={userId} onChange={e => setUserId(e.target.value)} style={{ padding: '15px', width: '100%', borderRadius: '10px', border: '2px solid #ddd', fontSize: '18px', boxSizing: 'border-box', marginBottom: '20px' }} />
            <button onClick={handleLogin} style={{ width: '100%', padding: '15px', background: '#000', color: '#fff', borderRadius: '10px', fontWeight: 'bold', border: 'none', fontSize: '18px' }}>ログイン</button>
          </div>
        ) : screen === 'home' ? (
          <div style={{ paddingTop: '40px', display: 'flex', flexDirection:'column', gap: '20px' }}>
            {role === 'student' && <button onClick={() => setScreen('upload')} style={{ padding: '40px', fontSize: '24px', background: '#000', color: '#fff', borderRadius: '20px', border: 'none', fontWeight: 'bold' }}>📷 写真を投稿する</button>}
            <button onClick={() => setScreen('gallery')} style={{ padding: '25px', fontSize: '20px', background: '#fff', border: '3px solid #000', borderRadius: '20px', fontWeight: 'bold' }}>📂 ギャラリーを見る</button>
            <p style={{ textAlign: 'center', color: '#666' }}>ID: {userId}</p>
          </div>
        ) : screen === 'upload' ? (
          <div style={{ background: '#fff', padding: '25px', borderRadius: '20px' }}>
            <h3>発見を報告</h3>
            <select value={uploadGroup} onChange={e => setUploadGroup(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '20px', borderRadius: '10px' }}>
              <option value="">班を選択...</option>
              {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} style={{ marginBottom: '20px' }} />
            <div style={{ marginBottom: '20px' }}>
              {!isRecording ? <button onClick={startRecording} style={{ background: '#0070f3', color: '#fff', padding: '10px', border: 'none', borderRadius: '5px' }}>🎤 録音開始</button> : <button onClick={stopRecording} style={{ background: 'red', color: '#fff', padding: '10px', border: 'none', borderRadius: '5px' }}>🛑 停止</button>}
              {audioBlob && " ✅"}
            </div>
            <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="メモ" style={{ width: '100%', height: '60px', marginBottom: '20px', padding: '10px' }} />
            <button onClick={handleUpload} disabled={uploading} style={{ width: '100%', padding: '15px', background: '#000', color: '#fff', borderRadius: '10px' }}>{uploading ? '送信中...' : '投稿する'}</button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2>{role === 'teacher' ? '管理画面' : '一覧'}</h2>
              <button onClick={() => setScreen('home')}>戻る</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              {posts.map(p => (
                <div key={p.id} style={{ background: '#fff', borderRadius: '10px', overflow: 'hidden', position: 'relative', border: '1px solid #ddd' }}>
                  {role === 'teacher' && <button onClick={() => handleDelete(p.id)} style={{ position: 'absolute', top: 5, right: 5, background: 'red', color: '#fff', border: 'none', borderRadius: '50%', width: 25, height: 25, zIndex: 10 }}>×</button>}
                  <img src={p.photo_url} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover' }} />
                  <div style={{ padding: '8px', fontSize: '11px' }}>
                    <strong>{p.group_name}</strong> ({p.user_id})<br/>{p.theme}
                    {p.audio_url && <audio src={p.audio_url} controls style={{ width: '100%', height: '25px', marginTop: '5px' }} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}