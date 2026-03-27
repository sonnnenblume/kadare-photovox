'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
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

  useEffect(() => {
    const savedRole = sessionStorage.getItem('kadare_role') as any
    const savedId = sessionStorage.getItem('kadare_user_id')
    if (savedRole) { setRole(savedRole); setUserId(savedId || ''); }
  }, [])

  useEffect(() => { if (screen === 'gallery') loadPosts() }, [screen])

  async function loadPosts() {
    const { data } = await supabase.from('posts').select('*').order('created_at', { ascending: false })
    if (data) setPosts(data)
  }

  function handleLogin() {
    if (!userId) return alert('学籍番号を入力してください')
    const userRole = userId === '0526' ? 'teacher' : 'student'
    setRole(userRole); sessionStorage.setItem('kadare_role', userRole); sessionStorage.setItem('kadare_user_id', userId);
  }

  async function handleUpload() {
    if (!uploadGroup || !imageFile) return alert('班と写真を選んでください')
    if (!userId) return alert('ログイン情報がありません。一度ログアウトしてログインし直してください')
    
    setUploading(true)
    try {
      // 1. Storageへのアップロード
      const fileName = `photo_${Date.now()}.jpg`
      const { error: upErr } = await supabase.storage.from('photos').upload(fileName, imageFile)
      if (upErr) throw upErr
      const photoUrl = `${supabaseUrl}/storage/v1/object/public/photos/${fileName}`
      
      // 2. データベースへの保存
      // 送信データを整理（idは含めない！）
      const insertData = { 
        user_id: String(userId),
        group_name: String(uploadGroup), 
        theme: String(comment), 
        photo_url: String(photoUrl)
      }

      const { error: dbErr } = await supabase.from('posts').insert([insertData])
      
      if (dbErr) throw dbErr
      alert('投稿成功！'); setComment(''); setImageFile(null); setScreen('gallery');
    } catch (e: any) {
      // エラーメッセージをより詳細に表示
      alert('【送信エラー】\n内容: ' + e.message + '\n送信したID: ' + userId)
    } finally { setUploading(false) }
  }

  return (
    <div style={{minHeight:'100vh', background:'#f8f9fa', fontFamily:'sans-serif'}}>
      <header style={{background:'#000', padding:'15px', color:'#fff', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h1 onClick={()=>setScreen('home')} style={{fontSize:20, cursor:'pointer', margin:0}}>PhotoVox</h1>
        {role && <button onClick={()=>{sessionStorage.clear();location.reload()}} style={{background:'none', color:'#fff', border:'1px solid #fff', borderRadius:20, padding:'4px 12px'}}>ログアウト</button>}
      </header>

      <main style={{maxWidth:500, margin:'0 auto', padding:20}}>
        {!role ? (
          <div style={{textAlign:'center', paddingTop:60}}>
            <h2>新入生研修</h2>
            <input type="text" placeholder="学籍番号を入力" value={userId} onChange={e=>setUserId(e.target.value)} style={{padding:15, width:'100%', borderRadius:10, border:'2px solid #ddd', marginBottom:20, boxSizing:'border-box', fontSize:18}} />
            <button onClick={handleLogin} style={{width:'100%', padding:15, background:'#000', color:'#fff', borderRadius:10, fontWeight:'bold', border:'none', fontSize:18}}>ログイン</button>
          </div>
        ) : screen === 'home' ? (
          <div style={{paddingTop:40, display:'flex', flexDirection:'column', gap:20}}>
            <button onClick={()=>setScreen('upload')} style={{padding:30, fontSize:22, background:'#000', color:'#fff', borderRadius:20, border:'none', fontWeight:'bold', boxShadow:'0 10px 20px rgba(0,0,0,0.1)'}}>📷 投稿する</button>
            <button onClick={()=>setScreen('gallery')} style={{padding:20, fontSize:18, background:'#fff', border:'2px solid #000', borderRadius:20, fontWeight:'bold'}}>📂 ギャラリーを見る</button>
          </div>
        ) : screen === 'upload' ? (
          <div style={{background:'#fff', padding:20, borderRadius:15, boxShadow:'0 2px 10px rgba(0,0,0,0.1)'}}>
            <h3 style={{marginTop:0}}>発見を投稿</h3>
            <p style={{fontSize:12, color:'#666'}}>ログインID: {userId}</p>
            <select value={uploadGroup} onChange={e=>setUploadGroup(e.target.value)} style={{width:'100%', padding:10, marginBottom:15, borderRadius:8}}>
              <option value="">班を選択...</option>
              {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <input type="file" accept="image/*" onChange={e=>setImageFile(e.target.files?.[0] || null)} style={{marginBottom:15, width:'100%'}} />
            <textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="どんな発見？" style={{width:'100%', height:80, marginBottom:20, padding:10, boxSizing:'border-box', borderRadius:8, border:'1px solid #ddd'}} />
            <button onClick={handleUpload} disabled={uploading} style={{width:'100%', padding:15, background:'#000', color:'#fff', borderRadius:10, fontWeight:'bold', border:'none', fontSize:18}}>
              {uploading ? '送信中...' : '投稿を完了する'}
            </button>
            <p onClick={()=>setScreen('home')} style={{textAlign:'center', marginTop:15, textDecoration:'underline', cursor:'pointer', color:'#666'}}>戻る</p>
          </div>
        ) : (
          <div>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
              <h2 style={{margin:0}}>ギャラリー</h2>
              <button onClick={()=>setScreen('home')} style={{padding:'5px 15px'}}>戻る</button>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
              {posts.map(p => (
                <div key={p.id} style={{background:'#fff', borderRadius:10, overflow:'hidden', border:'1px solid #eee', boxShadow:'0 2px 5px rgba(0,0,0,0.05)'}}>
                  <img src={p.photo_url} style={{width:'100%', aspectRatio:'1/1', objectFit:'cover'}} alt="" />
                  <div style={{padding:8, fontSize:12}}>
                    <div style={{fontWeight:'bold', color:'#000'}}>{p.group_name}</div>
                    <div style={{color:'#444', marginTop:4}}>{p.theme}</div>
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