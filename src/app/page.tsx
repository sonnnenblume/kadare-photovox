'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')

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
  const [screen, setScreen] = useState<'home'|'upload'|'gallery'|'mypage'>('home')
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
    const savedId = sessionStorage.getItem('kadare_user_id') || ''
    const savedGroup = sessionStorage.getItem('kadare_group') || ''
    if(savedRole) setRole(savedRole)
    if(savedId) setUserId(savedId)
    if(savedGroup) setCurrentGroup(savedGroup)
  }, [])

  useEffect(() => { 
    if (screen === 'gallery' || screen === 'mypage') loadPosts() 
  }, [screen, role, currentGroup])

  async function loadPosts() {
    const { data } = await supabase.from('posts').select('*').order('created_at', { ascending: false })
    if (data) {
      let filtered = data
      if (screen === 'mypage') {
        filtered = data.filter(p => p.user_id === sessionStorage.getItem('kadare_user_id'))
      } else if (role === 'group') {
        filtered = data.filter(p => p.group_name === currentGroup)
      }
      setPosts(filtered)
    }
  }

  async function handleLogin() {
    const input = userId.trim()
    let detectedRole: any = null
    if (input === TEACHER_PASSWORD) {
      detectedRole = 'teacher'
    } else if (GROUPS.includes(input)) {
      detectedRole = 'group'
      setCurrentGroup(input); sessionStorage.setItem('kadare_group', input)
    } else if (VALID_STUDENT_IDS.includes(input)) {
      detectedRole = 'student'
    } else { return alert(`ID "${input}" は登録されていません。`) }
    setRole(detectedRole); sessionStorage.setItem('kadare_role', detectedRole); sessionStorage.setItem('kadare_user_id', input)
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      const chunks: Blob[] = []
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data)
      mediaRecorder.onstop = () => setAudioBlob(new Blob(chunks, { type: 'audio/webm' }))
      mediaRecorder.start(); setIsRecording(true)
    } catch (err) { alert('マイクを許可してください') }
  }

  async function handleUpload() {
    if (!uploadGroup || !imageFile) return alert('グループ選択と写真が必要です')
    setUploading(true)
    const myId = sessionStorage.getItem('kadare_user_id')
    try {
      // 拡張子にかかわらず photo_〜.jpg という名前で保存
      const fileName = `photo_${Date.now()}.jpg`
      
      // 1. 画像アップロード (MIMEタイプをimage/jpegに固定)
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, imageFile, { contentType: 'image/jpeg' })
      if (uploadError) throw uploadError

      // 2. 公開URLを作成
      const photoUrl = `${supabaseUrl}/storage/v1/object/public/photos/${fileName}`
      
      let audioUrl = ''
      if (audioBlob) {
        const audioName = `audio_${Date.now()}.webm`
        await supabase.storage.from('photos').upload(audioName, audioBlob, { contentType: 'audio/webm' })
        audioUrl = `${supabaseUrl}/storage/v1/object/public/photos/${audioName}`
      }

      // 3. DBへ保存（theme列にURLとコメントを書き込む）
      const { error: dbError } = await supabase.from('posts').insert([{ 
        user_id: myId, 
        group_name: uploadGroup, 
        theme: comment, 
        photo_url: photoUrl, 
        audio_url: audioUrl 
      }])
      if (dbError) throw dbError

      alert('投稿成功！'); setScreen('gallery'); loadPosts();
    } catch (e: any) { alert('エラー：' + e.message) }
    setUploading(false)
  }

  return (
    <div style={{minHeight:'100vh',background:'#f5f0e8',color:'#1a1a1a',fontFamily:'sans-serif'}}>
      <header style={{background:'#1a1a1a',padding:'12px',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,zIndex:100}}>
        <div onClick={()=>setScreen('home')} style={{color:'#fff',fontSize:18,fontWeight:'bold',cursor:'pointer'}}>◎ PhotoVox</div>
        {role && <button onClick={()=>{sessionStorage.clear();setRole(null);setScreen('home');setUserId('')}} style={{background:'#444',color:'#fff',border:'none',padding:'5px 12px',borderRadius:20,fontSize:12}}>ログアウト</button>}
      </header>

      <main style={{maxWidth:600,margin:'0 auto',padding:20}}>
        {!role ? (
          <div style={{paddingTop:60,textAlign:'center'}}>
            <h1 style={{fontSize:22,fontWeight:'bold',marginBottom:30}}>新入生研修 PhotoVox</h1>
            <input type="text" placeholder="学籍番号を入力" value={userId} onChange={e=>setUserId(e.target.value)} 
              style={{padding:15,borderRadius:10,border:'3px solid #1a1a1a',width:'100%',maxWidth:280,fontSize:18,background:'#fff'}} />
            <br/><button onClick={handleLogin} style={{marginTop:20,background:'#1a1a1a',color:'#fff',padding:'15px 60px',borderRadius:10,fontWeight:'bold',fontSize:18,border:'none'}}>ログイン</button>
          </div>
        ) : screen === 'home' ? (
          <div style={{textAlign:'center',paddingTop:40}}>
            <h1 style={{fontSize:28,lineHeight:1.4,fontWeight:'bold'}}>カダーレの発見を<br/>声にする</h1>
            <div style={{marginTop:40,display:'flex',flexDirection:'column',gap:18,maxWidth:320,margin:'40px auto'}}>
              {(role === 'student' || role === 'teacher') && <button onClick={()=>setScreen('upload')} style={{background:'#1a1a1a',color:'#fff',padding:25,borderRadius:15,fontSize:20,fontWeight:'bold',border:'none'}}>📷 発見を投稿する</button>}
              {(role === 'student') && <button onClick={()=>setScreen('mypage')} style={{background:'#fff',color:'#1a1a1a',padding:15,borderRadius:15,border:'3px solid #1a1a1a',fontSize:16,fontWeight:'bold'}}>👤 自分の投稿を確認</button>}
              {(role === 'group' || role === 'teacher') && <button onClick={()=>setScreen('gallery')} style={{background:'#fff',color:'#1a1a1a',padding:20,borderRadius:15,border:'3px solid #1a1a1a',fontSize:16,fontWeight:'bold'}}>📂 {role === 'teacher' ? 'すべての投稿' : '班の投稿'}を見る</button>}
            </div>
          </div>
        ) : (
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <h2 style={{fontSize:18,fontWeight:'bold'}}>{screen === 'mypage' ? 'マイページ' : 'ギャラリー'}</h2>
              <button onClick={()=>setScreen('home')} style={{background:'#ddd',padding:'8px 15px',borderRadius:8,border:'none'}}>戻る</button>
            </div>
            {screen === 'upload' ? (
              <div style={{textAlign:'center'}}>
                <select value={uploadGroup} onChange={e=>setUploadGroup(e.target.value)} style={{width:'100%',padding:15,marginBottom:20,border:'3px solid #1a1a1a',borderRadius:10,background:'#fff'}}>
                  <option value="">グループを選択...</option>
                  {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <div style={{textAlign:'left',marginBottom:20}}>
                  <input type="file" accept="image/*" onChange={e=>setImageFile(e.target.files?.[0] || null)} />
                </div>
                <div style={{marginBottom:20}}>
                  {!isRecording ? <button onClick={startRecording} style={{background:'#f44336',color:'#fff',padding:'10px 20px',borderRadius:30,border:'none'}}>● 録音開始</button> : <button onClick={()=>mediaRecorderRef.current?.stop()} style={{background:'#333',color:'#fff',padding:'10px 20px',borderRadius:30,border:'none'}}>■ 停止</button>}
                  {audioBlob && <span style={{marginLeft:10,color:'green'}}>✓ 録音OK</span>}
                </div>
                <textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="発見メモ" style={{width:'100%',height:120,border:'3px solid #1a1a1a',borderRadius:10,padding:10,marginBottom:20,boxSizing:'border-box'}} />
                <button onClick={handleUpload} disabled={uploading} style={{width:'100%',padding:22,background:'#1a1a1a',color:'#fff',borderRadius:15,fontSize:20,fontWeight:'bold',border:'none'}}>
                  {uploading ? '送信中...' : '投稿を完了する'}
                </button>
              </div>
            ) : (
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                {posts.map(p => (
                  <div key={p.id} style={{background:'#fff',borderRadius:10,border:'1px solid #ddd',overflow:'hidden',boxShadow:'0 2px 5px rgba(0,0,0,0.1)'}}>
                    <img src={p.photo_url} style={{width:'100%',aspectRatio:'1/1',objectFit:'cover'}} alt="" />
                    <div style={{padding:10}}>
                      <div style={{fontSize:11,color:'#888',fontWeight:'bold'}}>{p.group_name}</div>
                      <div style={{fontSize:13,lineHeight:1.4,marginTop:4}}>{p.theme}</div>
                      {p.audio_url && <audio src={p.audio_url} controls style={{width:'100%',marginTop:8,height:30}} />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}