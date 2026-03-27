'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')

const TEACHER_PASSWORD = '0526' // ← ここがパスワードです
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

  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

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
    } else { 
      alert(`ID "${input}" は登録されていません。パスワードを確認してください。`) 
    }
    setUserId('')
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      const chunks: Blob[] = []
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data)
      mediaRecorder.onstop = () => setAudioBlob(new Blob(chunks, { type: 'audio/webm' }))
      mediaRecorder.start()
      setIsRecording(true)
    } catch (err) { alert('マイクの使用を許可してください') }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
  }

  async function handleUpload() {
    if (!uploadGroup || !imageFile) return alert('グループ選択と写真が必要です')
    setUploading(true)
    try {
      const photoName = `photo_${Date.now()}.jpg`
      await supabase.storage.from('photos').upload(photoName, imageFile)
      const photoUrl = supabase.storage.from('photos').getPublicUrl(photoName).data.publicUrl
      let audioUrl = ''
      if (audioBlob) {
        const audioName = `audio_${Date.now()}.webm`
        await supabase.storage.from('photos').upload(audioName, audioBlob)
        audioUrl = supabase.storage.from('photos').getPublicUrl(audioName).data.publicUrl
      }
      await supabase.from('posts').insert([{ 
        group_name: uploadGroup, comment: comment, photo_url: photoUrl, audio_url: audioUrl 
      }])
      alert('投稿しました！'); setScreen('home'); setComment(''); setImageFile(null); setAudioBlob(null); setUploadGroup('')
    } catch (e) { alert('エラーが発生しました') }
    setUploading(false)
  }

  return (
    <div style={{minHeight:'100vh',background:'#f5f0e8',color:'#1a1a1a',fontFamily:'sans-serif'}}>
      <header style={{background:'#1a1a1a',padding:'12px',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,zIndex:100}}>
        <div onClick={()=>setScreen('home')} style={{color:'#fff',fontSize:18,fontWeight:'bold',cursor:'pointer'}}>◎ PhotoVox</div>
        {role && <button onClick={()=>{sessionStorage.clear();setRole(null);setScreen('home')}} style={{background:'#444',color:'#fff',border:'none',padding:'5px 12px',borderRadius:20,fontSize:12}}>ログアウト</button>}
      </header>

      <main style={{maxWidth:600,margin:'0 auto',padding:20}}>
        {!role ? (
          <div style={{paddingTop:60,textAlign:'center'}}>
            <div style={{marginBottom:30}}>
              <p style={{fontSize:14,color:'#666',marginBottom:8}}>秋田県立大学 建築環境システム学科</p>
              <h1 style={{fontSize:22,fontWeight:'bold',lineHeight:1.4}}>新入生研修<br/>PhotoVox ログイン</h1>
            </div>
            <div style={{marginBottom:15}}>
              <label style={{display:'block',fontSize:13,textAlign:'left',maxWidth:280,margin:'0 auto 8px',fontWeight:'bold'}}>学籍番号またはパスワードを入力</label>
              <input type="text" placeholder="例：B28C001" value={userId} onChange={e=>setUserId(e.target.value)} 
                style={{padding:15,borderRadius:10,border:'3px solid #1a1a1a',width:'100%',maxWidth:280,fontSize:18,boxSizing:'border-box',background:'#fff',outline:'none'}} />
            </div>
            <button onClick={handleLogin} style={{background:'#1a1a1a',color:'#fff',padding:'15px 60px',borderRadius:10,border:'none',fontWeight:'bold',fontSize:18,boxShadow:'0 4px 0 #555'}}>ログイン</button>
            <p style={{marginTop:30,fontSize:12,color:'#888'}}>※教員用PWは「0526」です</p>
          </div>
        ) : screen === 'home' ? (
          <div style={{textAlign:'center',paddingTop:40}}>
            <p style={{fontSize:14,color:'#666',marginBottom:10}}>秋田県立大学 建築環境システム学科 新入生研修</p>
            <h1 style={{fontSize:28,lineHeight:1.4,fontWeight:'bold'}}>カダーレの発見を<br/>声にする</h1>
            <div style={{marginTop:40,display:'flex',flexDirection:'column',gap:18,maxWidth:320,margin:'40px auto'}}>
              {(role === 'student' || role === 'teacher') && <button onClick={()=>setScreen('upload')} style={{background:'#1a1a1a',color:'#fff',padding:25,borderRadius:15,border:'none',fontSize:20,fontWeight:'bold',boxShadow:'0 4px 8px rgba(0,0,0,0.2)'}}>📷 発見を投稿する</button>}
              {(role === 'group' || role === 'teacher') && <button onClick={()=>setScreen('gallery')} style={{background:'#fff',color:'#1a1a1a',padding:20,borderRadius:15,border:'3px solid #1a1a1a',fontSize:16,fontWeight:'bold'}}>
                {role === 'group' ? `${currentGroup} の投稿を見る` : 'すべての投稿を見る'}
              </button>}
            </div>
          </div>
        ) : screen === 'gallery' ? (
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,borderBottom:'2px solid #1a1a1a',paddingBottom:10}}>
              <h2 style={{fontSize:18,fontWeight:'bold'}}>{role === 'group' ? `${currentGroup} のギャラリー` : '全投稿ギャラリー'}</h2>
              <button onClick={()=>setScreen('home')} style={{background:'#ddd',border:'none',padding:'8px 15px',borderRadius:8,fontWeight:'bold'}}>戻る</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              {posts.map(p => (
                <div key={p.id} style={{background:'#fff',borderRadius:10,overflow:'hidden',boxShadow:'0 2px 5px rgba(0,0,0,0.1)',border:'1px solid #ddd'}}>
                  <img src={p.photo_url} style={{width:'100%',aspectRatio:'1/1',objectFit:'cover'}} />
                  <div style={{padding:10}}>
                    <div style={{fontSize:11,color:'#888',fontWeight:'bold'}}>{p.group_name}</div>
                    <div style={{fontSize:13,lineHeight:1.4,marginTop:4}}>{p.comment}</div>
                    {p.audio_url && <audio src={p.audio_url} controls style={{width:'100%',marginTop:8,height:30}} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{textAlign:'center'}}>
            <h2 style={{fontSize:22,marginBottom:25,fontWeight:'bold'}}>新しい発見を投稿</h2>
            
            <div style={{textAlign:'left',marginBottom:20}}>
              <label style={{fontSize:15,fontWeight:'bold'}}>1. 自分のグループを選択</label>
              <select value={uploadGroup} onChange={e=>setUploadGroup(e.target.value)} style={{width:'100%',padding:15,borderRadius:10,fontSize:16,marginTop:8,border:'3px solid #1a1a1a',background:'#fff'}}>
                <option value="">タップして選択してください</option>
                {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div style={{textAlign:'left',marginBottom:20}}>
              <label style={{fontSize:15,fontWeight:'bold'}}>2. 写真（カダーレで見つけたもの）</label>
              <div style={{marginTop:8,padding:'25px',border:'3px dashed #1a1a1a',borderRadius:10,background:'#fff',textAlign:'center'}}>
                <input type="file" accept="image/*" onChange={e=>setImageFile(e.target.files?.[0] || null)} style={{fontSize:15}} />
              </div>
            </div>

            <div style={{textAlign:'left',marginBottom:20}}>
              <label style={{fontSize:15,fontWeight:'bold'}}>3. 声で記録（任意）</label>
              <div style={{display:'flex',gap:15,alignItems:'center',marginTop:8,padding:'15px',background:'#fff',borderRadius:10,border:'2px solid #ccc'}}>
                {!isRecording ? (
                  <button onClick={startRecording} style={{background:'#f44336',color:'#fff',border:'none',padding:'12px 25px',borderRadius:30,fontSize:14,fontWeight:'bold',boxShadow:'0 3px 0 #b71c1c'}}>● 録音開始</button>
                ) : (
                  <button onClick={stopRecording} style={{background:'#333',color:'#fff',border:'none',padding:'12px 25px',borderRadius:30,fontSize:14,fontWeight:'bold'}}>■ 停止する</button>
                )}
                {audioBlob ? <span style={{fontSize:14,color:'green',fontWeight:'bold'}}>✓ 録音OK!</span> : <span style={{fontSize:12,color:'#888'}}>声を残せます</span>}
              </div>
            </div>

            <div style={{textAlign:'left',marginBottom:25}}>
              <label style={{fontSize:15,fontWeight:'bold'}}>4. 発見メモ・コメント</label>
              <textarea placeholder="例：光の入り方がきれい！" value={comment} onChange={e=>setComment(e.target.value)} 
                style={{width:'100%',height:120,padding:12,borderRadius:10,fontSize:16,marginTop:8,border:'3px solid #1a1a1a',boxSizing:'border-box'}} />
            </div>

            <button onClick={handleUpload} disabled={uploading} style={{width:'100%',padding:22,background:'#1a1a1a',color:'#fff',borderRadius:15,border:'none',fontSize:20,fontWeight:'bold',boxShadow:'0 5px 0 #555'}}>
              {uploading ? '送信中...' : '投稿を完了する'}
            </button>
            <button onClick={()=>setScreen('home')} style={{marginTop:25,background:'none',border:'none',color:'#888',textDecoration:'underline'}}>キャンセルして戻る</button>
          </div>
        )}
      </main>
    </div>
  )
}