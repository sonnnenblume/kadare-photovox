'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

// 1. Supabaseの初期化
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const GROUPS = ['groupA','groupB','groupC','groupD','groupE','groupF','groupG','groupH']

export default function Home() {
  const [role, setRole] = useState<'student' | 'teacher' | null>(null)
  const [userId, setUserId] = useState('')
  const [screen, setScreen] = useState<'home'|'upload'|'gallery'>('home')
  const [posts, setPosts] = useState<any[]>([])
  const [uploadGroup, setUploadGroup] = useState('')
  const [comment, setComment] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // ログイン状態の復元
  useEffect(() => {
    const savedRole = sessionStorage.getItem('kadare_role') as any
    const savedId = sessionStorage.getItem('kadare_user_id')
    if (savedRole && savedId) {
      setRole(savedRole)
      setUserId(savedId)
    }
  }, [])

  // ギャラリー表示時にデータを読み込む
  useEffect(() => {
    if (screen === 'gallery') {
      loadPosts()
    }
  }, [screen])

  // 【修正ポイント】created_atによる並び替えを削除し、エラーを回避
  async function loadPosts() {
    setErrorMsg(null)
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
      
      if (error) throw error
      setPosts(data || [])
    } catch (e: any) {
      console.error(e)
      setErrorMsg("データ取得に失敗しました: " + e.message)
    }
  }

  // ログイン処理
  function handleLogin() {
    if (!userId) return alert('学籍番号を入力してください')
    const userRole = userId === '0526' ? 'teacher' : 'student'
    setRole(userRole)
    sessionStorage.setItem('kadare_role', userRole)
    sessionStorage.setItem('kadare_user_id', userId)
  }

  // 投稿処理
  async function handleUpload() {
    if (!uploadGroup || !imageFile) return alert('班と写真を選択してください')
    setUploading(true)
    setErrorMsg(null)
    
    try {
      // ① Storageに保存
      const fileName = `photo_${Date.now()}.jpg`
      const { error: upErr } = await supabase.storage.from('photos').upload(fileName, imageFile)
      if (upErr) throw upErr

      // ② 公開URL生成
      const photoUrl = `${supabaseUrl}/storage/v1/object/public/photos/${fileName}`

      // ③ DB保存（すべて文字列として送信）
      const { error: dbErr } = await supabase.from('posts').insert([{ 
        user_id: String(userId),
        group_name: String(uploadGroup), 
        theme: String(comment || ""), 
        photo_url: String(photoUrl)
      }])
      
      if (dbErr) throw dbErr

      alert('投稿が完了しました！')
      setComment('')
      setImageFile(null)
      setScreen('gallery')
      loadPosts()
    } catch (e: any) {
      alert('エラーが発生しました: ' + e.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', color: '#1c1e21', fontFamily: 'sans-serif' }}>
      <header style={{ background: '#000', padding: '15px 20px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h1 onClick={() => setScreen('home')} style={{ fontSize: '22px', margin: 0, cursor: 'pointer', fontWeight: 'bold' }}>PhotoVox</h1>
        {role && (
          <button onClick={() => { sessionStorage.clear(); location.reload(); }} style={{ background: 'transparent', color: '#fff', border: '1px solid #fff', borderRadius: '20px', padding: '5px 15px', fontSize: '12px', cursor: 'pointer' }}>
            ログアウト
          </button>
        )}
      </header>

      <main style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
        {!role ? (
          <div style={{ textAlign: 'center', background: '#fff', padding: '40px 20px', borderRadius: '15px', marginTop: '40px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <h2 style={{ marginBottom: '30px' }}>新入生研修 ログイン</h2>
            <input type="text" placeholder="学籍番号を入力" value={userId} onChange={e => setUserId(e.target.value)} style={{ padding: '15px', width: '100%', borderRadius: '10px', border: '2px solid #ddd', fontSize: '18px', boxSizing: 'border-box', marginBottom: '20px' }} />
            <button onClick={handleLogin} style={{ width: '100%', padding: '15px', background: '#000', color: '#fff', borderRadius: '10px', fontWeight: 'bold', border: 'none', fontSize: '18px', cursor: 'pointer' }}>ログイン</button>
          </div>
        ) : 
        screen === 'home' ? (
          <div style={{ paddingTop: '40px', display: 'flex', flexDirection:'column', gap: '20px' }}>
            <button onClick={() => setScreen('upload')} style={{ padding: '40px', fontSize: '24px', background: '#000', color: '#fff', borderRadius: '20px', border: 'none', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 8px 16px rgba(0,0,0,0.2)' }}>
              📷 写真を投稿する
            </button>
            <button onClick={() => setScreen('gallery')} style={{ padding: '25px', fontSize: '20px', background: '#fff', color: '#000', border: '3px solid #000', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer' }}>
              📂 ギャラリーを見る
            </button>
          </div>
        ) : 
        screen === 'upload' ? (
          <div style={{ background: '#fff', padding: '25px', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginTop: 0, borderBottom: '2px solid #eee', paddingBottom: '10px' }}>新しい発見を報告</h3>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>担当の班</label>
              <select value={uploadGroup} onChange={e => setUploadGroup(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ccc', fontSize: '16px' }}>
                <option value="">班を選択...</option>
                {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>写真を選択</label>
              <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} style={{ width: '100%', padding: '10px', background: '#f8f9fa', borderRadius: '10px', border: '1px dashed #ccc' }} />
            </div>
            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>ひとことメモ</label>
              <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="どんな発見がありましたか？" style={{ width: '100%', height: '100px', padding: '12px', borderRadius: '10px', border: '1px solid #ccc', fontSize: '16px', boxSizing: 'border-box' }} />
            </div>
            <button onClick={handleUpload} disabled={uploading} style={{ width: '100%', padding: '18px', background: uploading ? '#ccc' : '#000', color: '#fff', borderRadius: '12px', fontWeight: 'bold', border: 'none', fontSize: '20px', cursor: uploading ? 'default' : 'pointer' }}>
              {uploading ? '送信中...' : '投稿を確定する'}
            </button>
            <p onClick={() => setScreen('home')} style={{ textAlign: 'center', marginTop: '20px', textDecoration: 'underline', cursor: 'pointer', color: '#666' }}>戻る</p>
          </div>
        ) : 
        (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>みんなの投稿</h2>
              <button onClick={() => setScreen('home')} style={{ padding: '8px 16px', borderRadius: '10px', background: '#fff', border: '1px solid #000', fontWeight: 'bold' }}>戻る</button>
            </div>
            {errorMsg && (
              <div style={{ padding: '15px', background: '#fff1f0', border: '1px solid #ffa39e', color: '#cf1322', borderRadius: '10px', marginBottom: '20px' }}>
                {errorMsg}
                <button onClick={loadPosts} style={{ marginLeft: '10px', background: '#fff', border: '1px solid #cf1322', borderRadius: '4px' }}>再試行</button>
              </div>
            )}
            {posts.length === 0 && !errorMsg ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
                <p style={{ fontSize: '18px' }}>まだ投稿がありません</p>
                <button onClick={loadPosts} style={{ marginTop: '10px', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}>更新する</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
                {posts.map(p => (
                  <div key={p.id} style={{ background: '#fff', borderRadius: '15px', overflow: 'hidden', boxShadow: '0 4px 8px rgba(0,0,0,0.05)', border: '1px solid #eee' }}>
                    <div style={{ width: '100%', aspectRatio: '1/1', background: '#eee' }}>
                      <img src={p.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="写真" loading="lazy" />
                    </div>
                    <div style={{ padding: '12px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#fff', background: '#333', display: 'inline-block', padding: '2px 8px', borderRadius: '5px', marginBottom: '6px' }}>{p.group_name}</div>
                      <div style={{ fontSize: '13px', color: '#333', lineHeight: '1.4' }}>{p.theme}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ height: '50px' }}></div>
          </div>
        )}
      </main>
    </div>
  )
}