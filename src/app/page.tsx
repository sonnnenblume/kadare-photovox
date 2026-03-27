'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')

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
    if (savedRole) setRole(savedRole)
  }, [])

  useEffect(() => { if (screen === 'gallery') loadPosts() }, [screen])

  async function loadPosts() {
    const { data } = await supabase.from('posts').select('*').order('created_at', { ascending: false })
    if (data) setPosts(data)
  }

  async function handleLogin() {
    if (!userId) return alert('IDを入力してください')
    setRole(userId === '0526' ? 'teacher' : 'student')
    sessionStorage.setItem('kadare_role', userId === '0526' ? 'teacher' : 'student')
    sessionStorage.setItem('kadare_user_id', userId)
  }

  async function handleUpload() {
    if (!uploadGroup || !imageFile) return alert('班と写真を選んでください')
    setUploading(true)

    try {
      const fileName = `photo_${Date.now()}.jpg`
      const { error: upErr } = await supabase.storage.from('photos').upload(fileName, imageFile, { contentType: 'image/jpeg' })
      if (upErr) throw upErr

      const photoUrl = `${supabaseUrl}/storage/v1/object/public/photos/${fileName}`

      // 【重要】idに Date.now() を使うことで、DBの自動採番設定が漏れていてもエラーを防ぎます
      const { error: dbErr } = await supabase.from('posts').insert([{ 
        id: Math.floor(Date.now() / 1000), 
        user_id: userId || sessionStorage.getItem('kadare_user_id') || 'guest',
        group_name: uploadGroup, 
        theme: comment, 
        photo_url: photoUrl
      }])
      
      if (dbErr) throw dbErr
      alert('投稿完了！'); setScreen('gallery')
    } catch (e: any) {
      alert('送信エラー: ' + e.message)
    }
    setUploading(false)
  }

  return (
    <div style={{minHeight:'100vh', background:'#f8f9fa', color:'#333', fontFamily:'sans-serif'}}>
      <header style={{background:'#000', padding:'15px', color:'#fff', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h1 onClick={()=>setScreen('home')} style={{fontSize:20, margin:0, cursor:'pointer'}}>PhotoVox</h1>
        {role && <button onClick={()=>{sessionStorage.clear();location.reload()}} style={{background:'none', color:'#fff', border:'1px solid #fff', borderRadius:20, padding:'2px 10px', fontSize:12}}>ログアウト</button>}
      </header>

      <main style={{maxWidth:500, margin:'0 auto', padding:20}}>
        {!role ? (
          <div style={{textAlign:'center', paddingTop:60}}>
            <h2 style={{marginBottom:30}}>新入生研修</h2>
            <input type="text" placeholder="学籍番号を入力" value={userId} onChange={e=>setUserId(e.target.value)} style={{padding:15, width:'100%', borderRadius:10, border:'2px solid #ddd', fontSize:18, boxSizing:'border-box', marginBottom:20}} />
            <button onClick={handleLogin} style={{width:'100%', padding:15, background:'#000', color:'#fff', borderRadius:10, fontWeight:'bold', border:'none', fontSize:18}}>ログイン</button>
          </div>
        ) : screen === 'home' ? (
          <div style={{paddingTop:40}}>
            <button onClick={()=>setScreen('upload')} style={{width:'100%', padding:30, fontSize:22, background:'#000', color:'#fff', borderRadius:15, marginBottom:20, border:'none', fontWeight:'bold'}}>📷 投稿する</button>
            <button onClick={()=>setScreen('gallery')} style={{width:'100%', padding:20, fontSize:18, background:'#fff', border:'2px solid #000', borderRadius:15, fontWeight:'bold'}}>📂 ギャラリーを見る</button>
          </div>
        ) : screen === 'upload' ? (
          <div style={{background:'#fff', padding:20, borderRadius:15, boxShadow:'0 2px 10px rgba(0,0,0,0.1)'}}>
            <h3 style={{marginTop:0}}>発見を投稿</h3>
            <div style={{marginBottom:15}}>
              <label style={{display:'block', fontWeight:'bold', marginBottom:5}}>1. 班を選択</label>
              <select value={uploadGroup} onChange={e=>setUploadGroup(e.target.value)} style={{width:'100%', padding:10, borderRadius:8}}>
                <option value="">選択...</option>
                {['groupA','groupB','groupC','groupD','groupE','groupF','groupG','groupH'].map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div style={{marginBottom:15}}>
              <label style={{display:'block', fontWeight:'bold', marginBottom:5}}>2. 写真を選ぶ</label>
              <input type="file" accept="image/*" onChange={e=>setImageFile(e.target.files?.[0] || null)} style={{width:'100%'}} />
            </div>
            <div style={{marginBottom:20}}>
              <label style={{display:'block', fontWeight:'bold', marginBottom:5}}>3. メモ（任意）</label>
              <textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="どんな発見？" style={{width:'100%', height:80, padding:10, borderRadius:8, border:'1px solid #ddd', boxSizing:'border-box'}} />
            </div>
            <button onClick={handleUpload} disabled={uploading} style={{width:'100%', padding:15, background:'#000', color:'#fff', borderRadius:10, fontWeight:'bold', border:'none', fontSize:18}}>
              {uploading ? '送信中...' : '投稿を完了する'}
            </button>
            <p onClick={()=>setScreen('home')} style={{textAlign:'center', marginTop:15, textDecoration:'underline', cursor:'pointer', fontSize:14}}>キャンセル</p>
          </div>
        ) : (
          <div>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
              <h2 style={{margin:0, fontSize:18}}>ギャラリー</h2>
              <button onClick={()=>setScreen('home')} style={{fontSize:12, padding:'5px 10px'}}>戻る</button>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
              {posts.map(p => (
                <div key={p.id} style={{background:'#fff', borderRadius:10, overflow:'hidden', boxShadow:'0 2px 5px rgba(0,0,0,0.05)'}}>
                  <img src={p.photo_url} style={{width:'100%', aspectRatio:'1/1', objectFit:'cover'}} alt="" />
                  <div style={{padding:8}}>
                    <div style={{fontSize:10, fontWeight:'bold', color:'#666'}}>{p.group_name}</div>
                    <div style={{fontSize:12, marginTop:4, lineHeight:1.3}}>{p.theme || '...'}</div>