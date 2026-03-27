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
    if (savedRole) setRole(savedRole)
    if (savedId) setUserId(savedId)
  }, [])

  useEffect(() => {
    if (screen === 'gallery') loadPosts()
  }, [screen])

  async function loadPosts() {
    const { data, error } = await supabase.from('posts').select('*').order('created_at', { ascending: false })
    if (data) setPosts(data)
  }

  async function handleLogin() {
    if (!userId) return alert('学籍番号またはIDを入力してください')
    const userRole = userId === '0526' ? 'teacher' : 'student'
    setRole(userRole)
    sessionStorage.setItem('kadare_role', userRole)
    sessionStorage.setItem('kadare_user_id', userId)
  }

  async function handleUpload() {
    if (!uploadGroup || !imageFile) return alert('班と写真を選んでください')
    setUploading(true)

    try {
      // 1. Storageへの画像アップロード (iPhone/HEIC対策含む)
      const fileName = `photo_${Date.now()}.jpg`
      const { error: upErr } = await supabase.storage
        .from('photos')
        .upload(fileName, imageFile, { contentType: 'image/jpeg' })
      if (upErr) throw upErr

      const photoUrl = `${supabaseUrl}/storage/v1/object/public/photos/${fileName}`

      // 2. データベースへの保存
      // idは含めない(Supabaseの自動採番に任せる)
      // user_idは学籍番号(文字列)として送る
      const { error: dbErr } = await supabase.from('posts').insert([{ 
        user_id: String(userId || sessionStorage.getItem('kadare_user_id')),
        group_name: uploadGroup, 
        theme: comment, 
        photo_url: photoUrl
      }])
      
      if (dbErr) throw dbErr
      
      alert('投稿が完了しました！')
      setComment(''); setImageFile(null); setScreen('gallery')
    } catch (e: any) {
      alert('送信エラーが発生しました: ' + e.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{minHeight:'100vh', background:'#f8f9fa', color:'#333', fontFamily:'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'}}>
      <header style={{background:'#000', padding:'15px 20px', color:'#fff', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, zIndex:100}}>
        <h1 onClick={()=>setScreen('home')} style={{fontSize:20, margin:0, cursor:'pointer', fontWeight:800}}>PhotoVox</h1>
        {role && <button onClick={()=>{sessionStorage.clear();location.reload()}} style={{background:'transparent', color:'#fff', border:'1px solid #fff', borderRadius:20, padding:'4px 12px', fontSize:12}}>ログアウト</button>}
      </header>

      <main style={{maxWidth:500, margin:'0 auto', padding:'20px', boxSizing:'border-box'}}>
        {!role ? (
          <div style={{textAlign:'center', paddingTop:60}}>
            <h2 style={{fontSize:24, marginBottom:10, fontWeight:700}}>新入生研修</h2>
            <p style={{color:'#666', marginBottom:30}}>ログインしてください</p>
            <input type="text" placeholder="学籍番号を入力" value={userId} onChange={e=>setUserId(e.target.value)} style={{padding:15, width:'100%', borderRadius:12, border:'2px solid #ddd', fontSize:18, boxSizing:'border-box', marginBottom:20}} />
            <button onClick={handleLogin} style={{width:'100%', padding:15, background:'#000', color:'#fff', borderRadius:12, fontWeight:'bold', border:'none', fontSize:18, cursor:'pointer'}}>ログイン</button>
          </div>
        ) : screen === 'home' ? (
          <div style={{paddingTop:40}}>
            <h2 style={{fontSize:28, textAlign:'center', lineHeight:1.3, marginBottom:40, fontWeight:800}}>カダーレの発見を<br/>声にしよう</h2>
            <div style={{display:'flex', flexDirection:'column', gap:20}}>
              <button onClick={()=>setScreen('upload')} style={{padding:30, fontSize:22, background:'#000', color:'#fff', borderRadius:20, border:'none', fontWeight:'bold', boxShadow:'0 10px 20px rgba(0,0,0,0.1)', cursor:'pointer'}}>📷 投稿する</button>
              <button onClick={()=>setScreen('gallery')} style={{padding:20, fontSize:18, background:'#fff', border:'3px solid #000', borderRadius:20, fontWeight:'bold', cursor:'pointer'}}>📂 ギャラリーを見る</button>
            </div>
          </div>
        ) : screen === 'upload' ? (
          <div style={{background:'#fff', padding:20, borderRadius:20, boxShadow:'0 4px 15px rgba(0,0,0,0.05)'}}>
            <h3 style={{marginTop:0, borderBottom:'2px solid #f0f0f0', paddingBottom:15, marginBottom:20}}>発見を投稿</h3>
            
            <label style={{display:'block', fontWeight:700, marginBottom:8}}>1. 班を選択</label>
            <select value={uploadGroup} onChange={e=>setUploadGroup(e.target.value)} style={{width:'100%', padding:12, borderRadius:10, border:'1px solid #ddd', fontSize:16, marginBottom:20}}>
              <option value="">選択してください...</option>
              {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>

            <label style={{display:'block', fontWeight:700, marginBottom:8}}>2. 写真を選ぶ</label>
            <input type="file" accept="image/*" onChange={e=>setImageFile(e.target.files?.[0] || null)} style={{width:'100%', marginBottom:20}} />

            <label style={{display:'block', fontWeight:700, marginBottom:8}}>3. メモ（任意）</label>
            <textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="どんな発見ですか？" style={{width:'100%', height:100, padding:12, borderRadius:10, border:'1px solid #ddd', fontSize:16, boxSizing:'border-box', marginBottom:25}} />

            <button onClick={handleUpload} disabled={uploading} style={{width:'100%', padding:20, background:'#000', color:'#fff', borderRadius:15, fontWeight:'bold', border:'none', fontSize:20, cursor:'pointer'}}>
              {uploading ? '送信中...' : '投稿を完了する'}
            </button>
            <p onClick={()=>setScreen('home')} style={{textAlign:'center', marginTop:20, textDecoration:'underline', cursor:'pointer', color:'#666'}}>戻る</p>
          </div>
        ) : (
          <div>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
              <h2 style={{margin:0, fontSize:22, fontWeight:80