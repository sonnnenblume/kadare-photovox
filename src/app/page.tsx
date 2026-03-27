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
  
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  useEffect(() => {
    const savedRole = sessionStorage.getItem('kadare_role') as any
    const savedId = sessionStorage.getItem('kadare_user_id')
    if (savedRole && savedId) { 
      setRole(savedRole); 
      setUserId(savedId); 
    }
  }, [])

  useEffect(() => {
    if (screen === 'gallery' && role) loadPosts()
  }, [screen, role])

  // --- 【修正】データ取得ロジックの改善 ---
  async function loadPosts() {
    try {
      // 基本は全件取得のクエリを作成
      let query = supabase.from('posts').select('*').order('created_at', { ascending: false })
      
      if (role === 'teacher') {
        // 教員は何もしない（全件取得）
      } else if (role === 'viewer') {
        // グループ閲覧：入力されたID（GroupAなど）を含むものを検索
        query = query.ilike('group_name', `%${userId}%`)
      } else if (role === 'student') {
        // 学生閲覧：自分の学籍番号を含むものを検索
        query = query.ilike('user_id', `%${userId}%`)
      }

      const { data, error } = await query
      if (error) throw error
      
      console.log("取得データ:", data); // ブラウザのコンソールで確認用
      setPosts(data || [])
    } catch (e: any) { 
      console.error("データ取得エラー:", e)
    }
  }

  async function handleDelete(postId: string) {
    if (!confirm('この投稿を削除しますか？')) return
    try {
      const { error } = await supabase.from('posts').delete().eq('id', postId)
      if (error) throw error
      alert('削除しました'); loadPosts();
    } catch (e: any) { alert('削除失敗: ' + e.message) }
  }

  function handleLogin() {
    const id = userId.trim()
    if (!id) return alert('IDを入力してください')
    
    let userRole: 'student' | 'viewer' | 'teacher' = 'student'
    if (id === '0526') {
      userRole = 'teacher'
    } else if (GROUPS.some(g => id.toLowerCase() === g.toLowerCase())) {
      userRole = 'viewer'
    }
    
    setRole(userRole)
    setUserId(id)
    sessionStorage.setItem('kadare_role', userRole)
    sessionStorage.setItem('kadare_user_id', id)
  }

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
      await supabase.storage.from('photos').upload(imgName, imageFile)
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
            <p style={{ textAlign: 'center', color: '#666' }}>ログイン中: {userId}</p>
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
            <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="内容を入力" style={{ width: '100%', height: '80px', marginBottom: '20px', padding: '10px', boxSizing: 'border-box', borderRadius: '10px' }} />
            <button onClick={handleUpload} disabled={uploading} style={{ width: '100%', padding: '18px', background: uploading ? '#ccc' : '#000', color: '#fff', borderRadius: '12px', fontWeight: 'bold', fontSize: '20px' }}>
              {uploading ? '送信中...' : '投稿を確定する'}
            </button>
            <p onClick={() => setScreen('home')} style={{ textAlign: 'center', marginTop: '15px', textDecoration: 'underline', cursor: 'pointer', color: '#666' }}>戻る</p>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>{role === 'teacher' ? '管理：全投稿' : '自分の投稿'}</h2>
              <button onClick={() => setScreen('home')} style={{ padding: '8px 16px', borderRadius: '10px', background: '#fff', border: '1px solid #000' }}>戻る</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
              {posts.map(p => (
                <div key={p.id} style={{ background: '#fff', borderRadius: '15px', overflow: 'hidden', border: '1px solid #eee', position: 'relative' }}>
                  {role === 'teacher' && (
                    <button onClick={() => handleDelete(p.id)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'red', color: '#fff', border: 'none', borderRadius: '50%', width: '30px', height: '30px', fontWeight: 'bold', cursor: 'pointer', zIndex: 100 }}>×</button>
                  )}
                  <img src={p.photo_url} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover' }} alt="写真" />
                  <div style={{ padding: '10px' }}>
                    <div style={{ fontSize: '10px', color: '#666' }}>{p.group_name} / ID:{p.user_id}</div>
                    <div style={{ fontSize: '13px', color: '#333', marginTop: '4px' }}>{p.theme}</div>
                    {p.audio_url && <audio src={p.audio_url} controls style={{ width: '100%', height: '30px', marginTop: '8px' }} />}
                  </div>
                </div>
              ))}
            </div>
            {posts.length === 0 && <p style={{ textAlign: 'center', color: '#999', marginTop: '40px' }}>データが見つかりません</p>}
          </div>
        )}
      </main>
    </div>
  )
}