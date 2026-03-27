'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')

const TEACHER_PASSWORD = '0526'
const GROUPS = ['groupA','groupB','groupC','groupD','groupE','groupF','groupG','groupH']
const VALID_STUDENT_IDS = [
  ...Array.from({ length: 40 }, (_, i) => `B28C${String(i + 1).padStart(3, '0')}`),
  ...Array.from({ length: 20 }, (_, i) => `guest${i + 1}`)
]

export default function Home() {
  const [role, setRole] = useState<'student' | 'teacher' | 'group' | null>(null)
  const [userId, setUserId] = useState('')
  const [currentGroup, setCurrentGroup] = useState('')
  const [screen, setScreen] = useState<'home'|'upload'|'gallery'>('home')
  const [posts, setPosts] = useState<any[]>([])

  const [uploadGroup, setUploadGroup] = useState('')
  const [comment, setComment] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    const savedRole = sessionStorage.getItem('kadare_role') as any
    const savedGroup = sessionStorage.getItem('kadare_group') || ''
    if(savedRole) setRole(savedRole)
    if(savedGroup) setCurrentGroup(savedGroup)
  }, [])

  useEffect(() => { if (screen === 'gallery') loadPosts() }, [screen, role, currentGroup])

  async function loadPosts() {
    let query = supabase.from('posts').select('*').order('created_at', { ascending: false })
    if (role === 'group') query = query.eq('group_name', currentGroup)
    const { data } = await query
    if (data) setPosts(data)
  }

  async function handleLogin() {
    const input = userId.trim()
    if (input === TEACHER_PASSWORD) {
      setRole('teacher'); sessionStorage.setItem('kadare_role', 'teacher')
    } else if (GROUPS.includes(input)) {
      setRole('group'); setCurrentGroup(input);
      sessionStorage.setItem('kadare_role', 'group'); sessionStorage.setItem('kadare_group', input)
    } else if (VALID_STUDENT_IDS.includes(input)) {
      setRole('student'); sessionStorage.setItem('kadare_role', 'student')
    } else { alert('IDが違います') }
    setUserId('')
  }

  async function handleUpload() {
    if (!uploadGroup || !imageFile) return alert('グループ選択と写真が必要です')
    setUploading(true)
    const fileName = `${Date.now()}_${imageFile.name}`
    const { data: storageData, error: storageError } = await supabase.storage.from('photos').upload(fileName, imageFile)
    if (storageError) { alert('アップロード失敗'); setUploading(false); return }
    const photoUrl = supabase.storage.from('photos').getPublicUrl(fileName).data.publicUrl
    const { error: dbError } = await supabase.from('posts').insert([{ group_name: uploadGroup, comment: comment, photo_url: photoUrl }])
    if (!dbError) {
      alert('投稿しました！'); setScreen('home'); setComment(''); setImageFile(null); setUploadGroup('')
    }
    setUploading(false)
  }

  return (
    <div style={{minHeight:'100vh',background:'#f5f0e8',color:'#1a1a1a',fontFamily:'sans-serif'}}>
      <header style={{background:'#1a1a1a',padding:'12px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div onClick={()=>setScreen('home')} style={{color:'#fff',fontSize:18,fontWeight:'bold',cursor:'pointer'}}>◎ PhotoVox</div>
        {role && <button onClick={()=>{sessionStorage.clear();setRole(null);setScreen('home')}} style={{background:'#444',color:'#fff',border:'none',padding:'5px 12px',borderRadius:20,fontSize:12}}>ログアウト</button>}
      </header>

      <main style={{maxWidth:600,margin:'0 auto',padding:20}}>
        {!role ? (
          <div style={{paddingTop:100,textAlign:'center'}}>
            <h1>ログイン</h1>
            <input type="text" placeholder="ID / PW" value={userId} onChange={e=>setUserId(e.target.value)} style={{padding:12,width:'80%',marginBottom:10}} /><br/>
            <button onClick={handleLogin} style={{padding:'10px 40px',background:'#1a1a1a',color:'#fff',borderRadius:8}}>ログイン</button>
          </div>
        ) : screen === 'home' ? (
          <div style={{textAlign:'center',paddingTop:40}}>
            <h1>カダーレの発見を声にする</h1>
            <div style={{marginTop:40,display:'flex',flexDirection:'column',gap:15}}>
              {(role === 'student' || role === 'teacher') && <button onClick={()=>setScreen('upload')} style={{background:'#1a1a1a',color:'#fff',padding:20,borderRadius:8,fontSize:18,fontWeight:'bold'}}>📷 投稿する</button>}
              {(role === 'group' || role === 'teacher') && <button onClick={()=>setScreen('gallery')} style={{background:'#fff',padding:20,borderRadius:8,border:'2px solid #1a1a1a',fontSize:16}}>{role === 'group' ? '自グループの投稿を見る' : '全投稿を見る'}</button>}
            </div>
          </div>
        ) : screen === 'gallery' ? (
          <div>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}><h2>ギャラリー</h2><button onClick={()=>setScreen('home')}>戻る</button></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {posts.map(p => (
                <div key={p.id} style={{background:'#fff',borderRadius:8,overflow:'hidden',boxShadow:'0 2px 4px rgba(0,0,0,.1)'}}>
                  <img src={p.photo_url} style={{width:'100%',aspectRatio:'1/1',objectFit:'cover'}} />
                  <div style={{padding:8}}><small>{p.group_name}</small><br/>{p.comment}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{textAlign:'center'}}>
            <h2 style={{marginBottom:20}}>新規投稿</h2>
            <div style={{textAlign:'left',marginBottom:15}}>
              <label style={{fontSize:12,color:'#666'}}>1. 投稿するグループを選択</label>
              <select value={uploadGroup} onChange={e=>setUploadGroup(e.target.value)} style={{width:'100%',padding:12,borderRadius:8,fontSize:16}}>
                <option value="">グループを選択...</option>
                {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div style={{textAlign:'left',marginBottom:15}}>
              <label style={{fontSize:12,color:'#666'}}>2. 写真を選択</label>
              <input type="file" accept="image/*" onChange={e=>setImageFile(e.target.files?.[0] || null)} style={{width:'100%',padding:10,background:'#fff',borderRadius:8}} />
            </div>
            <div style={{textAlign:'left',marginBottom:15}}>
              <label style={{fontSize:12,color:'#666'}}>3. 発見したこと（コメント）</label>
              <textarea placeholder="ここに書いてください" value={comment} onChange={e=>setComment(e.target.value)} style={{width:'100%',height:100,padding:10,borderRadius:8,fontSize:16}} />
            </div>
            <button onClick={handleUpload} disabled={uploading} style={{width:'100%',padding:15,background:'#1a1a1a',color:'#fff',borderRadius:8,fontSize:18,fontWeight:'bold'}}>
              {uploading ? '送信中...' : '投稿を完了する'}
            </button>
            <button onClick={()=>setScreen('home')} style={{marginTop:20,background:'none',border:'none',color:'#888',textDecoration:'underline'}}>キャンセル</button>
          </div>
        )}
      </main>
    </div>
  )
}