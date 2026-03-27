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
    if (!userId) return alert('IDを入力してください')
    if (userId === '0526') {
      setRole('teacher'); sessionStorage.setItem('kadare_role', 'teacher')
    } else {
      setRole('student'); sessionStorage.setItem('kadare_role', 'student')
    }
    sessionStorage.setItem('kadare_user_id', userId)
  }

  async function handleUpload() {
    if (!uploadGroup || !imageFile) return alert('班の選択と写真が必要です')
    setUploading(true)
    
    // IDが空だとエラーになるため、確実に取得
    const myId = userId || sessionStorage.getItem('kadare_user_id') || "999"

    try {
      const fileName = `photo_${Date.now()}.jpg`
      
      // 1. Storageに保存
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, imageFile, { contentType: 'image/jpeg' })
      if (uploadError) throw uploadError

      const photoUrl = `${supabaseUrl}/storage/v1/object/public/photos/${fileName}`

      // 2. データベースに保存 (user_idは文字列として送信)
      const { error: dbError } = await supabase.from('posts').insert([{ 
        user_id: String(myId), 
        group_name: uploadGroup, 
        theme: comment, 
        photo_url: photoUrl
      }])
      
      if (dbError) throw dbError

      alert('投稿に成功しました！')
      setComment(''); setImageFile(null); setScreen('gallery')
    } catch (e: any) {
      alert('エラーが発生しました：' + e.message)
    }
    setUploading(false)
  }

  return (
    <div style={{minHeight:'100vh',background:'#f5f0e8',fontFamily:'sans-serif',color:'#333'}}>
      <header style={{background:'#1a1a1a',padding:'15px',color:'#fff',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <b onClick={()=>setScreen('home')} style={{cursor:'pointer'}}>◎ PhotoVox</b>
        {role && <span style={{fontSize:12,cursor:'pointer'}} onClick={()=>{sessionStorage.clear();location.reload()}}>ログアウト</span>}
      </header>

      <main style={{maxWidth:600,margin:'0 auto',padding:20}}>
        {!role ? (
          <div style={{textAlign:'center',paddingTop:50}}>
            <h2>新入生研修 PhotoVox</h2>
            <input type="text" placeholder="学籍番号またはID" value={userId} onChange={e=>setUserId(e.target.value)} style={{padding:12,width:'80%',margin:'20px 0',borderRadius:8,border:'2px solid #333',fontSize:16}} />
            <br/><button onClick={handleLogin} style={{padding:'12px 60px',background:'#1a1a1a',color:'#fff',borderRadius:8,fontWeight:'bold',border:'none'}}>ログイン</button>
          </div>
        ) : screen === 'home' ? (
          <div style={{textAlign:'center',paddingTop:40}}>
            <button onClick={()=>setScreen('upload')} style={{width:'100%',padding:35,fontSize:22,background:'#1a1a1a',color:'#fff',borderRadius:15,marginBottom:20,border:'none',fontWeight:'bold',boxShadow:'0 4px 10px rgba(0,0,0,0.2)'}}>📷 発見を投稿する</button>
            <button onClick={()=>setScreen('gallery')} style={{width:'100%',padding:20,fontSize:18,background:'#fff',border:'3px solid #1a1a1a',borderRadius:15,fontWeight:'bold'}}>📂 全員の投稿を見る</button>
          </div>
        ) : screen === 'upload' ? (
          <div>
            <h3 style={{borderBottom:'2px solid #1a1a1a',paddingBottom:10}}>発見を投稿</h3>
            <div style={{marginTop:20}}>
              <label><b>1. グループ選択</b></label>
              <select value={uploadGroup} onChange={e=>setUploadGroup(e.target.value)} style={{width:'100%',padding:12,marginTop:8,marginBottom:20,borderRadius:8}}>
                <option value="">選択してください</option>
                {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>

              <label><b>2. 写真</b></label>
              <input type="file" accept="image/*" onChange={e=>setImageFile(e.target.files?.[0] || null)} style={{display:'block',marginTop:8,marginBottom:20}} />

              <label><b>3. コメント</b></label>
              <textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="見つけた発見を書いてください" style={{width:'100%',height:100,padding:10,marginTop:8,marginBottom:20,borderRadius:8,boxSizing:'border-box',border:'1px solid #ccc'}} />

              <button onClick={handleUpload} disabled={uploading} style={{width:'100%',padding:20,background:'#1a1a1a',color:'#fff',borderRadius:10,fontWeight:'bold',border:'none',fontSize:18}}>
                {uploading ? '送信中...' : '投稿を完了する'}
              </button>
              <p onClick={()=>setScreen('home')} style={{textAlign:'center',marginTop:20,textDecoration:'underline',cursor:'pointer'}}>戻る</p>
            </div>
          </div>
        ) : (
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <h3>ギャラリー</h3>
              <button onClick={()=>setScreen('home')} style={{padding:'8px 15px'}}>戻る</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:15}}>
              {posts.map(p => (
                <div key={p.id} style={{background:'#fff',borderRadius:10,overflow:'hidden',boxShadow:'0 2px 5px rgba(0,0,0,0.1)'}}>
                  <img src={p.photo_url} style={{width:'100%',aspectRatio:'1/1',objectFit:'cover'}} alt="投稿" />
                  <div style={{padding:10}}>
                    <div style={{fontSize:11,color:'#888',fontWeight:'bold'}}>{p.group_name}</div>
                    <div style={{fontSize:13,marginTop:5,lineHeight:1.4}}>{p.theme}</div>
                    <div style={{fontSize:10,color:'#ccc',marginTop:5}}>ID: {p.user_id}</div>
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