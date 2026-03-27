'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const GROUPS = ['GroupA','GroupB','GroupC','GroupD','GroupE','GroupF','GroupG','GroupH']

export default function Home() {
  const [role, setRole] = useState<'student' | 'viewer' | 'teacher' | null>(null)
  const [userId, setUserId] = useState('')
  const [screen, setScreen] = useState<'home'|'upload'|'gallery'>('home')
  const [posts, setPosts] = useState<any[]>([])
  const [uploadGroup, setUploadGroup] = useState('')
  const [comment, setComment] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  
  // 音声録音
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

  // --- 1. 閲覧制限付きのデータ取得 ---
  async function loadPosts() {
    try {
      let query = supabase.from('posts').select('*').order('created_at', { ascending: false })
      
      if (role === 'teacher') {
        // 教員(0526): 全件表示
      } else if (role === 'viewer') {
        // グループ(GroupA-H): 自分の班の名前と一致する投稿のみ
        query = query.eq('group_name', userId)
      } else if (role === 'student') {
        // 学生(学籍番号): 自分が投稿したIDのもののみ
        query = query.eq('user_id', userId)
      }

      const { data, error } = await query
      if (error) throw error
      setPosts(data || [])
    } catch (e: any) { console.error(e) }
  }

  // --- 2. 教員専用の削除機能 ---
  async function handleDelete(postId: string) {
    if (!confirm('この投稿を削除しますか？')) return
    try {
      const { error } = await supabase.from('posts').delete().eq('id', postId)
      if (error) throw error
      alert('削除しました'); loadPosts();
    } catch (e: any) { alert('削除失敗: ' + e.message) }
  }

  function handleLogin() {
    if (!userId) return alert('IDを入力してください')
    const trimmedId = userId.trim()
    let userRole: 'student' | 'viewer' | 'teacher' = 'student'
    
    if (trimmedId === '0526') {
      userRole = 'teacher'
    } else if (GROUPS.includes(trimmedId)) {
      userRole = 'viewer'
    }
    
    setRole(userRole)
    sessionStorage.setItem('kadare_role', userRole); sessionStorage.setItem('kadare_user_id', trimmedId);
    setUserId(trimmedId)
  }

  // --- 3. 音声録音機能 ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const chunks: BlobPart[] = []
      recorder.ondataavailable = (e) => chunks.push(e.data)
      recorder.onstop = () => setAudioBlob(new Blob(chunks, { type: 'audio/m4a' }))
      recorder.start(); mediaRecorderRef.current = recorder; setIsRecording(true);
    } catch (e) { alert("マイクの使用を許可してください") }
  }

  const stopRecording = () => { mediaRecorderRef.current?.stop(); setIsRecording(false); }

  async function handleUpload() {
    if (!uploadGroup) return alert('班を選択してください')
    if (!imageFile) return alert('写真を選択してください')
    setUploading(true)
    try {
      const imgName = `photo_${Date.now()}.jpg`
      const { error: imgErr } = await supabase.storage.from('photos').upload(imgName, imageFile)
      if (imgErr) throw imgErr
      const photoUrl = `${supabaseUrl}/storage/v1/object/public/photos/${imgName}`

      let audioUrl = ""
      if (audioBlob) {
        const audName = `audio_${Date.now()}.m4a`
        const { error: audErr } = await supabase.storage.from('photos').upload(audName, audioBlob)
        if (!audErr) audioUrl = `${supabaseUrl}/storage/v1/object/public/photos/${audName}`
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
            <h2>ログイン</h2>
            <input type="text" placeholder="IDを入力" value={userId} onChange={e => setUserId(e.target.value)} style={{ padding: '15px', width: '100%', borderRadius: '10px', border: '2px solid #ddd', fontSize: '18px', boxSizing: 'border-box', marginBottom: '20px' }} />
            <button onClick={handleLogin} style={{ width: '100%', padding: '15px', background: '#000', color: '#fff', borderRadius: '10px', fontWeight: 'bold', border: 'none', fontSize: '18px' }}>ログイン</button>
          </div>
        ) : screen === 'home' ? (
          <div style={{ paddingTop: '40px', display: 'flex', flexDirection:'column', gap: '20px' }}>
            {role === 'student' && (
              <button onClick={() => setScreen('upload')} style={{ padding: '40px', fontSize: '24px', background: '#000', color: '#fff', borderRadius: '20px', border: 'none', fontWeight: 'bold' }}>📷 写真を投稿する</button>
            )}
            <button onClick={() => setScreen('gallery')} style={{ padding: '25px', fontSize: '20px', background: '#fff', border: '3px solid #000', borderRadius: '20px', fontWeight: 'bold' }}>📂 ギャラリーを見る</button>
            <p style={{ textAlign: 'center', color: '#666' }}>ログインID: {userId}</p>
          </div>
        ) : screen === 'upload' ? (
          <div style={{ background: '#fff', padding: '25px', borderRadius: '20px' }}>
            <h3 style={{ marginTop: 0 }}>発見を報告</h3>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>担当の班</label>
              <select value={uploadGroup} onChange={e => setUploadGroup(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ccc', fontSize: '16px' }}>
                <option value="">班を選択...</option>
                {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>写真を選択</label>
              <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} style={{ width: '100%', padding: '10px' }} />
            </div>
            <div style={{ marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '10px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>音声メモ</label>
              {!isRecording ? (
                <button onClick={startRecording} style={{ padding: '10px 20px', borderRadius: '10px', background: '#0070f3', color: '#fff', border: 'none' }}>🎤 録音開始</button>
              ) : (
                <button onClick={stopRecording} style={{ padding: '10px 20px', borderRadius: '10px', background: '#ff4d4f', color: '#fff', border: 'none' }}>🛑 録音停止</button>
              )}
              {audioBlob && <span style={{ marginLeft: '10px', color: 'green' }}>✓ 録音済み</span>}
            </div>
            <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="メモを入力" style={{ width: '100%', height: '80px', marginBottom: '20px', padding: '10px', boxSizing: 'border-box', borderRadius: '10px' }} />
            <button onClick={handleUpload} disabled={uploading} style={{ width: '100%', padding: '18px', background: uploading ? '#ccc' : '#000', color: '#fff', borderRadius: '12px', fontWeight: 'bold', fontSize: '20px' }}>
              {uploading ? '送信中...' : '投稿を確定する'}
            </button>
            <p onClick={() => setScreen('home')} style={{ textAlign: 'center', marginTop: '15px', textDecoration: 'underline', cursor: 'pointer', color: '#666' }}>戻る</p>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>{role === 'teacher' ? '全投稿' : role === 'viewer' ? `${userId}の投稿` : '自分の投稿'}</h2>
              <button onClick={() => setScreen('home')} style={{ padding: '8px 16px', borderRadius: '10px', background: '#fff', border: '1px solid #000' }}>戻る</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
              {posts.map(p => (
                <div key={p.id} style={{ background: '#fff', borderRadius: '15px', overflow: 'hidden', border: '1px solid #eee', position: 'relative' }}>
                  {role === 'teacher' && (
                    <button onClick={() => handleDelete(p.id)} style={{ position: 'absolute', top: '5px', right: '5px', background: 'rgba(255,0,0,0.7)', color: '#fff', border: 'none', borderRadius: '50%', width: '25px', height: '25px', fontSize: '12px', cursor: 'pointer', zIndex: 10 }}>×</button>
                  )}
                  <img src={p.photo_url} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover' }} alt="写真" />
                  <div style={{ padding: '10px' }}>
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '10px', background: '#333', color: '#fff', padding: '2px 5px', borderRadius: '3px' }}>{p.group_name}</span>
                      <span style={{ fontSize: '10px', background: '#0070f3', color: '#fff', padding: '2px 5px', borderRadius: '3px' }}>ID:{p.user_id}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#333', marginBottom: '8px' }}>{p.theme}</div>
                    {p.audio_url && <audio src={p.audio_url} controls style={{ width: '100%', height: '30px' }} />}
                  </div>
                </div>
              ))}
            </div>
            {posts.length === 0 && <p style={{ textAlign: 'center', color: '#999', marginTop: '40px' }}>表示できる投稿がありません</p>}
          </div>
        )}
      </main>
    </div>
  )
}