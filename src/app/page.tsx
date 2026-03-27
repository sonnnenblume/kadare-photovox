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
    if (!uploadGroup || !imageFile) return alert('グループと写真を選んでください')
    setUploading(true)
    
    // エラー回避：もしIDが数字でない場合は強制的に「0」扱いにする（DBの型エラー対策）
    const numericId = parseInt(userId || sessionStorage.getItem('kadare_user_id') || '0', 10)
    const finalId = isNaN(numericId) ? 0 : numericId

    try {
      const fileName = `photo_${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('photos').upload(fileName, imageFile, { contentType: 'image/jpeg' })
      if (uploadError) throw uploadError

      const photoUrl = `${supabaseUrl}/storage/v1/object/public/photos/${fileName}`

      // DB保存（型エラーが出ないよう値を調整）
      const { error: dbError } = await supabase.from('posts').insert([{ 
        user_id: String(finalId), // ここを文字列として送る
        group_name: uploadGroup, 
        theme: comment, 
        photo_url: photoUrl
      }])
      
      if (dbError) throw dbError

      alert('投稿完了！')
      setComment(''); setImageFile(null); setScreen('gallery')
    } catch (e: any) {
      alert('送信エラー: ' + e.message)
    }
    setUploading(false)
  }

  return (
    <div style={{minHeight:'100vh', background:'#f8f9fa', color:'#212529', fontFamily:'system-ui, -apple-system, sans-serif'}}>
      <header style={{background:'#000', padding:'15px 20px', color:'#fff', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, zIndex:100, boxShadow:'0 2px 10px rgba(0,0,0,0.1)'}}>
        <h1 onClick={()=>setScreen('home')} style={{fontSize:'1.2rem', margin:0, cursor:'pointer', fontWeight:800}}>PhotoVox</h1>
        {role && <button onClick={()=>{sessionStorage.clear();location.reload()}} style={{background:'transparent', border:'1px solid #fff', color:'#fff', padding:'4px 12px', borderRadius:20, fontSize:'12px'}}>ログアウト</button>}
      </header>

      <main style={{maxWidth:500, margin:'0 auto', padding:'20px', boxSizing:'border-box'}}>
        {!role ? (
          <div style={{textAlign:'center', paddingTop:80}}>
            <h2 style={{fontSize:'1.5rem', marginBottom:10}}>新入生研修</h2>
            <p style={{color:'#666', marginBottom:30}}>学籍番号を入力してください</p>
            <input type="text" placeholder="例: B28C001" value={userId} onChange={e=>setUserId(e.target.value)} style={{padding:15, width:'100%', borderRadius:12, border:'2px solid #ddd', fontSize:18, textAlign:'center', marginBottom:20, boxSizing:'border-box'}} />
            <button onClick={handleLogin} style={{width:'100%', padding:15, background:'#000', color:'#fff', borderRadius:12, fontWeight:'bold', border:'none', fontSize:18}}>ログイン</button>
          </div>
        ) : screen === 'home' ? (
          <div style={{paddingTop:40}}>
            <h2 style={{fontSize:'1.8rem', lineHeight:1.3, marginBottom:40, textAlign:'center'}}>カダーレでの発見を<br/>みんなで共有しよう</h2>
            <button onClick={()=>setScreen('upload')} style={{width:'100%', padding:30, fontSize:22, background:'#000', color:'#fff', borderRadius:20, marginBottom:20, border:'none', fontWeight:'bold', boxShadow:'0 10px 20px rgba(0,0,0,0.1)'}}>📷 投稿する</button>
            <button onClick={()=>setScreen('gallery')} style={{width:'100%', padding:20, fontSize:18, background:'#fff', border:'2px solid #000', borderRadius:20, fontWeight:'bold'}}>📂 ギャラリーを見る</button>
          </div>
        ) : screen === 'upload' ? (
          <div>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
              <h2 style={{margin:0}}>発見を投稿</h2>
              <button onClick={()=>setScreen('home')} style={{background:'none', border:'none', textDecoration:'underline'}}>戻る</button>
            </div>
            <div style={{background:'#fff', padding:20, borderRadius:20, boxShadow:'0 4px 15px rgba(0,0,0,0.05)'}}>
              <div style={{marginBottom:20}}>
                <label style={{display:'block', fontWeight:'bold', marginBottom:8}}>1. 班を選択</label>
                <select value={uploadGroup} onChange={e=>setUploadGroup(e.target.value)} style={{width:'100%', padding:12, borderRadius:10, border:'1px solid #ddd', fontSize:16}}>
                  <option value="">選択...</option>
                  {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div style={{marginBottom:20}}>
                <label style={{display:'block', fontWeight:'bold', marginBottom:8}}>2. 写真を選ぶ</label>
                <input type="file" accept="image/*" onChange={e=>setImageFile(e.target.files?.[0] || null)} style={{width:'100%'}} />
              </div>
              <div style={{marginBottom:25}}>
                <label style={{display:'block', fontWeight:'bold', marginBottom:8}}>3. メモ（任意）</label>
                <textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="どんな発見ですか？" style={{width:'100%', height:100, padding:12, borderRadius:10, border:'1px solid #ddd', fontSize:16, boxSizing:'border-box'}} />
              </div>
              <button onClick={handleUpload} disabled={uploading} style={{width:'100%', padding:20, background:'#000', color:'#fff', borderRadius:15, fontWeight:'bold', border:'none', fontSize:20}}>
                {uploading ? '送信中...' : '投稿を完了する'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
              <h2 style={{margin:0}}>ギャラリー</h2>
              <button onClick={()=>setScreen('home')} style={{background:'#fff', border:'1px solid #ddd', padding:'8px 15px', borderRadius:10}}>戻る</button>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
              {posts.map(p => (
                <div key={p.id} style={{background:'#fff', borderRadius:15, overflow:'hidden', boxShadow:'0 4px 10px rgba(0,0,0,0.05)'}}>
                  <img src={p.photo_url} style={{width:'100%', aspectRatio:'1/1', objectFit:'cover'}} alt="発見" />
                  <div style={{padding:10}}>
                    <div style={{fontSize:11, color:'#000', fontWeight:'bold', background:'#eee', display:'inline-block', padding:'2px 8px', borderRadius:4}}>{p.group_name}</div>
                    <div style={{fontSize:13, marginTop:8, lineHeight:1.4, minHeight:'2.8em'}}>{p.theme || '（メモなし）'}</div>
                  </div>
                </div>
              ))}
            </div>
            {posts.length === 0 && <p style={{textAlign:'center', color:'#999', marginTop:40}}>まだ投稿がありません</p>}
          </div>
        )}
      </main>
    </div>
  )
}