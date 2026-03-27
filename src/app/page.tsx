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
    if (savedRole) setRole(savedRole)
  }, [])

  useEffect(() => { 
    if (screen === 'gallery') loadPosts() 
  }, [screen])

  async function loadPosts() {
    const { data } = await supabase.from('posts').select('*').order('created_at', { ascending: false })
    if (data) setPosts(data)
  }

  async function handleLogin() {
    if (!userId) return alert('IDを入力してください')
    const userRole = userId === '0526' ? 'teacher' : 'student'
    setRole(userRole)
    sessionStorage.setItem('kadare_role', userRole)
    sessionStorage.setItem('kadare_user_id', userId)
  }

  async function handleUpload() {
    if (!uploadGroup || !imageFile) return alert('班と写真を選んでください')
    setUploading(true)

    try {
      const fileName = `photo_${Date.now()}.jpg`
      // 1. Storageへアップロード
      const { error: upErr } = await supabase.storage.from('photos').upload(fileName, imageFile, { contentType: 'image/jpeg' })
      if (upErr) throw upErr

      const photoUrl = `${supabaseUrl}/storage/v1/object/public/photos/${fileName}`

      // 2. DBへ保存（idは含めず、Supabaseの自動採番に任せる）
      const { error: dbErr } = await supabase.from('posts').insert([{ 
        user_id: userId || sessionStorage.getItem('kadare_user_id') || 'guest',
        group_name: uploadGroup, 
        theme: comment, 
        photo_url: photoUrl
      }])
      
      if (dbErr) throw dbErr
      alert('投稿完了！'); setComment(''); setImageFile(null); setScreen('gallery')
    } catch (e: any) {
      alert('送信エラー: ' + e.message)
    }
    setUploading(false)
  }

  return (
    <div style={{minHeight:'100vh', background:'#f8f9fa', color:'#333', fontFamily:'sans-serif'}}>
      <header style={{background:'#000', padding:'15px', color:'#fff', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, zIndex:100}}>
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
          <div style={{paddingTop:40, display:'flex', flexDirection:'column', gap:20}}>
            <button onClick={()=>