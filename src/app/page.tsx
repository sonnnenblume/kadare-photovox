'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const GROUPS = ['GroupA','GroupB','GroupC','GroupD','GroupE','GroupF','GroupG','GroupH']

const toHalfWidth = (str: string) => str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));

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

  async function loadPosts() {
    try {
      // フィルタを一度すべて外して「全件取得」を試みます
      const { data, error } = await supabase.from('posts').select('*').order('created_at', { ascending: false })
      
      if (error) {
        console.error("【詳細エラー】:", error.message, error.details, error.hint);
        throw error;
      }

      // 取得した後に、プログラム側でフィルタリングする（これが一番安全です）
      if (role === 'teacher') {
        setPosts(data || [])
      } else if (role === 'viewer') {
        setPosts(data?.filter(p => p.group_name === userId) || [])
      } else {
        setPosts(data?.filter(p => p.user_id === userId) || [])
      }
    } catch (e: any) {
      alert("通信エラー: " + e.message + "\nSupabaseのRLS設定を確認してください。");
    }
  }

  async function handleDelete(postId: string) {
    if (!confirm('削除しますか？')) return
    const { error } = await supabase.from('posts').delete().eq('id', postId)
    if (!error) loadPosts();
  }

  function handleLogin() {
    const id = toHalfWidth(userId.trim());
    if (!id) return alert('入力してください');
    let userRole: 'student' | 'viewer' | 'teacher' = 'student';
    if (id === '0526') userRole = 'teacher';
    else if (GROUPS.some(g => g.toLowerCase() === id.toLowerCase())) {
        userRole = 'viewer';
        const matched = GROUPS.find(g => g.toLowerCase() === id.toLowerCase()) || id;
        setUserId(matched);
    } else {
        setUserId(id);
    }
    setRole(userRole);
    sessionStorage.setItem('kadare_role', userRole);
    sessionStorage.setItem('kadare_user_id', id);
  }

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const recorder = new MediaRecorder(stream)
    const chunks: any[] = []
    recorder.ondataavailable = (e) => chunks.push(e.data)
    recorder.onstop = () => setAudioBlob(new Blob(chunks, { type: 'audio/m4a' }))
    recorder.start(); mediaRecorderRef.current = recorder; setIsRecording(true);
  }
  const stopRecording = () => { mediaRecorderRef.current?.stop(); setIsRecording(false); }

  async function handleUpload() {
    if (!uploadGroup || !imageFile) return alert('班と写真を選択してください');
    setUploading(true);
    try {
      const imgName = `photo_${Date.now()}.jpg`;
      await supabase.storage.from('photos').upload(imgName, imageFile);
      const photoUrl = `${supabaseUrl}/storage/v1/object/public/photos/${imgName}`;
      let audioUrl = "";
      if (audioBlob) {
        const audName = `audio_${Date.now()}.m4a`;
        await supabase.storage.from('photos').upload(audName, audioBlob);
        audioUrl = `${supabaseUrl}/storage/v1/object/public/photos/${audName}`;
      }
      await supabase.from('posts').insert([{ user_id: userId, group_name: uploadGroup, theme: comment, photo_url: photoUrl, audio_url: audioUrl }]);
      alert('完了'); setScreen('gallery');
    } catch (e: any) { alert(e.message) } finally { setUploading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', fontFamily: 'sans-serif' }}>
      <header style={{ background: '#000', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between' }}>
        <h1 onClick={() => setScreen('home')}>PhotoVox</h1>
        {role && <button onClick={() => { sessionStorage.clear(); location.reload(); }}>ログアウト</button>}
      </header>
      <main style={{ maxWidth: '500px', margin: '0 auto', padding: '20px' }}>
        {!role ? (
          <div>
            <h2>ログイン</h2>
            <input type="text" placeholder="学籍番号を入力" value={userId} onChange={e => setUserId(e.target.value)} style={{ width: '100%', padding: '15px', marginBottom: '10px' }} />
            <button onClick={handleLogin} style={{ width: '100%', padding: '15px', background: '#000', color: '#fff' }}>ログイン</button>
          </div>
        ) : screen === 'home' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '40px' }}>
            {role === 'student' && <button onClick={() => setScreen('upload')} style={{ padding: '30px', fontSize: '20px' }}>📷 投稿する</button>}
            <button onClick={() => setScreen('gallery')} style={{ padding: '30px', fontSize: '20px' }}>📂 ギャラリー</button>
          </div>
        ) : screen === 'upload' ? (
          <div style={{ background: '#fff', padding: '20px' }}>
            <select value={uploadGroup} onChange={e => setUploadGroup(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px' }}>
              <option value="">班を選択</option>
              {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} />
            <div style={{ margin: '15px 0' }}>
              {!isRecording ? <button onClick={startRecording}>🎤 録音</button> : <button onClick={stopRecording} style={{ color: 'red' }}>🛑 停止</button>}
              {audioBlob && " ✅"}
            </div>
            <textarea value={comment} onChange={e => setComment(e.target.value)} style={{ width: '100%', height: '60px' }} />
            <button onClick={handleUpload} disabled={uploading} style={{ width: '100%', padding: '15px', background: '#000', color: '#fff' }}>送信</button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><h2>一覧</h2><button onClick={() => setScreen('home')}>戻る</button></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {posts.map(p => (
                <div key={p.id} style={{ background: '#fff', position: 'relative', border: '1px solid #ddd' }}>
                  {role === 'teacher' && <button onClick={() => handleDelete(p.id)} style={{ position: 'absolute', top: 0, right: 0, background: 'red', color: '#fff' }}>×</button>}
                  <img src={p.photo_url} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover' }} />
                  <div style={{ padding: '5px', fontSize: '10px' }}>
                    <b>{p.group_name}</b><br/>{p.theme}
                    {p.audio_url && <audio src={p.audio_url} controls style={{ width: '100%', height: '20px' }} />}
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