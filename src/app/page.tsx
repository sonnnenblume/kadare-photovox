'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const GROUPS = ['GroupA','GroupB','GroupC','GroupD','GroupE','GroupF','GroupG','GroupH']

export default function Home() {
  const [role, setRole] = useState<'student' | 'viewer' | null>(null)
  const [userId, setUserId] = useState('')
  const [screen, setScreen] = useState<'home'|'upload'|'gallery'>('home')
  const [posts, setPosts] = useState<any[]>([])
  const [uploadGroup, setUploadGroup] = useState('')
  const [comment, setComment] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const savedRole = sessionStorage.getItem('kadare_role') as any
    const savedId = sessionStorage.getItem('kadare_user_id')
    if (savedRole && savedId) {
      setRole(savedRole); setUserId(savedId);
    }
  }, [])

  useEffect(() => {
    if (screen === 'gallery') loadPosts()
  }, [screen])

  async function loadPosts() {
    setErrorMsg(null)
    try {
      const { data, error } = await supabase.from('posts').select('*')
      if (error) throw error
      setPosts(data || [])
    } catch (e: any) {
      setErrorMsg("取得失敗: " + e.message)
    }
  }

  function handleLogin() {
    if (!userId) return alert('学籍番号またはグループIDを入力してください')
    const isViewer = userId.startsWith('Group') || userId === '0526'
    const userRole = isViewer ? 'viewer' : 'student'
    setRole(userRole); sessionStorage.setItem('kadare_role', userRole); sessionStorage.setItem('kadare_user_id', userId);
  }

  async function handleUpload() {
    if (!uploadGroup) return alert('担当の班を選択してください')
    if (!imageFile) return alert('写真を選択してください')
    setUploading(true)
    try {
      const fileName = `photo_${Date.now()}.jpg`
      const { error: upErr } = await supabase.storage.from('photos').upload(fileName, imageFile)
      if (upErr) throw upErr
      const photoUrl = `${supabaseUrl}/storage/v1/object/public/photos/${fileName}`
      
      // 【最重要修正】列名が "group_name" か "group" か不明なため、両方に対応させます
      const postData: any = { 
        user_id: String(userId),
        theme: String(comment || ""), 
        photo_url: String(photoUrl),
        group_name: String(uploadGroup), // 元の想定
        group: String(uploadGroup)      // 予備（列名が group の場合対策）
      }

      const { error: dbErr } = await supabase.from('posts').insert([postData])
      
      if (dbErr) throw dbErr
      alert('投稿完了！'); setComment(''); setImageFile(null); setUploadGroup(''); setScreen('gallery');
    } catch (e: any) {
      alert('エラー: ' + e.message)
    } finally { setUploading(false) }
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
            <input type="text" placeholder="学籍番号 または GroupID" value={userId} onChange={e => setUserId(e.target.value)} style={{ padding: '15px', width: '100%', borderRadius: '10px', border: '2px solid #ddd', fontSize: '18px', boxSizing: 'border-box', marginBottom: '20px' }} />
            <button onClick={handleLogin} style={{ width: '100%', padding: '15px', background: '#000', color: '#fff', borderRadius: '10px', fontWeight: 'bold', border: 'none', fontSize: '18px' }}>ログイン</button>
          </div>
        ) : screen === 'home' ? (
          <div style={{ paddingTop: '40px', display: 'flex', flexDirection:'column', gap: '20px' }}>
            {role === 'student' && (
              <button onClick={() => setScreen('upload')} style={{ padding: '40px', fontSize: '24px', background: '#000', color: '#fff', borderRadius: '20px', border: 'none', fontWeight: 'bold', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }}>📷 写真を投稿する</button>
            )}
            <button onClick={() => setScreen('gallery')} style={{ padding: '25px', fontSize: '20px', background: '#fff', border: '3px solid #000', borderRadius: '20px', fontWeight: 'bold' }}>📂 ギャラリーを見る</button>
          </div>
        ) : screen === 'upload' ? (
          <div style={{ background: '#fff', padding: '25px', borderRadius: '20px' }}>
            <h3 style={{ marginTop: 0 }}>新しい発見を報告</h3>
            <p style={{ fontSize: '12px', color: '#666' }}>ID: {userId}</p>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>担当の班</label>
              <select value={uploadGroup} onChange={e => setUploadGroup(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ccc', fontSize: '16px' }}>
                <option value="">班を選択してください...</option>
                {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>写真を選択</label>
              <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} style={{ width: '100%', padding: '10px', background: '#f8f9fa', borderRadius: '10px', border: '1px dashed #ccc' }} />
            </div>
            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>メモ</label>
              <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="内容を入力" style={{ width: '100%', height: '100px', padding: '12px', borderRadius: '10px', border: '1px solid #ccc', fontSize: '16px', boxSizing: 'border-box' }} />
            </div>
            <button onClick={handleUpload} disabled={uploading} style={{ width: '100%', padding: '18px', background: uploading ? '#ccc' : '#000', color: '#fff', borderRadius: '12px', fontWeight: 'bold', fontSize: '20px' }}>
              {uploading ? '送信中...' : '投稿を確定する'}
            </button>
            <p onClick={() => setScreen('home')} style={{ textAlign: 'center', marginTop: '20px', textDecoration: 'underline', cursor: 'pointer', color: '#666' }}>戻る</p>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>ギャラリー</h2>
              <button onClick={() => setScreen('home')} style={{ padding: '8px 16px', borderRadius: '10px', background: '#fff', border: '1px solid #000' }}>戻る</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
              {posts.map(p => (
                <div key={p.id} style={{ background: '#fff', borderRadius: '15px', overflow: 'hidden', border: '1px solid #eee' }}>
                  <img src={p.photo_url} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover' }} alt="写真" />
                  <div style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#fff', background: '#333', padding: '2px 6px', borderRadius: '4px' }}>{p.group_name || p.group}</span>
                      <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#fff', background: '#0070f3', padding: '2px 6px', borderRadius: '4px' }}>{p.user_id}</span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#333' }}>{p.theme}</div>
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