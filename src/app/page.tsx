'use client'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import JSZip from 'jszip'

const GROUPS = ['A','B','C','D','E','F','G','H']
const STUDENT_PASSWORD = '0519'
const TEACHER_PASSWORD = '0526'
const GROUP_PASSWORDS: Record<string,string> = {
  A:'group-A', B:'group-B', C:'group-C', D:'group-D',
  E:'group-E', F:'group-F', G:'group-G', H:'group-H'
}
const MAX_PHOTOS = 10

const VALID_IDS = [
  ...Array.from({length:40}, (_,i) => 'B28C' + String(i+1).padStart(3,'0')),
  ...Array.from({length:20}, (_,i) => 'guest' + String(i+1))
]

type Post = {
  id: number
  created_at: string
  group_name: string
  comment: string
  photo_url: string
  audio_url: string | null
  student_name: string | null
  like_count?: number
}
type Role = 'student' | 'teacher' | 'group'

function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    const img = new Image()
    const reader = new FileReader()
    reader.onload = (ev) => {
      img.onload = () => {
        const MAX = 1200
        let w = img.width, h = img.height
        if(w > MAX || h > MAX) {
          if(w > h) { h = Math.round(h * MAX / w); w = MAX }
          else { w = Math.round(w * MAX / h); h = MAX }
        }
        canvas.width = w; canvas.height = h
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
        canvas.toBlob((blob) => {
          if(!blob) { resolve(file); return }
          resolve(new File([blob], file.name, {type: 'image/jpeg'}))
        }, 'image/jpeg', 0.75)
      }
      img.src = ev.target!.result as string
    }
    reader.readAsDataURL(file)
  })
}

function formatTime(sec: number) {
  return `${Math.floor(sec/60).toString().padStart(2,'0')}:${(sec%60).toString().padStart(2,'0')}`
}

export default function Home() {
  const [role, setRole] = useState<Role|null>(null)
  const [groupView, setGroupView] = useState<string|null>(null)
  const [pwInput, setPwInput] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [screen, setScreen] = useState<'home'|'upload'|'gallery'>('home')
  const [posts, setPosts] = useState<Post[]>([])
  const [group, setGroup] = useState('')
  const [comment, setComment] = useState('')
  const [studentName, setStudentName] = useState('')
  const [studentId, setStudentId] = useState('')
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob|null>(null)
  const [audioURL, setAudioURL] = useState<string|null>(null)
  const [recSec, setRecSec] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitProgress, setSubmitProgress] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const [selected, setSelected] = useState<Post|null>(null)
  const [editing, setEditing] = useState(false)
  const [editComment, setEditComment] = useState('')
  const [editGroup, setEditGroup] = useState('')
  const [filterGroup, setFilterGroup] = useState('ALL')
  const [myPostIds, setMyPostIds] = useState<number[]>([])
  const [likedPostIds, setLikedPostIds] = useState<number[]>([])
  const mediaRecRef = useRef<MediaRecorder|null>(null)
  const timerRef = useRef<NodeJS.Timeout|null>(null)
  const chunksRef = useRef<Blob[]>([])

function handleLogout() {
    sessionStorage.removeItem('kadare_role')
    sessionStorage.removeItem('kadare_student_id')
    sessionStorage.removeItem('kadare_group_view')
    sessionStorage.removeItem('kadare_my_posts')
    sessionStorage.removeItem('kadare_liked_posts')

    setRole(null)
    setStudentId('')
    setGroupView(null)
    setPwInput('')
    setPwError(null)
    setMyPostIds([])
    setLikedPostIds([])
    setScreen('home')
  }

useEffect(() => {
  const savedRole = sessionStorage.getItem('kadare_role') as Role|null
  const savedGroup = sessionStorage.getItem('kadare_group_view')
  if(savedRole) { setRole(savedRole); if(savedGroup) setGroupView(savedGroup) }

  const ids = JSON.parse(sessionStorage.getItem('kadare_my_posts') || '[]')
  setMyPostIds(ids)

  const liked = JSON.parse(sessionStorage.getItem('kadare_liked_posts') || '[]')
  setLikedPostIds(liked)
}, [])

  useEffect(() => { if(screen==='gallery') loadPosts() }, [screen])

  async function loadPosts() {
    const { data } = await supabase.from('posts').select('*').order('created_at',{ascending:false})
    if(data) setPosts(data)
  }

async function handleLogin() {
  setPwError(null)

  if (pwInput === TEACHER_PASSWORD) {
    setRole('teacher')
    sessionStorage.setItem('kadare_role', 'teacher')
    return
  }

  if (pwInput === STUDENT_PASSWORD) {
    setRole('student')
    sessionStorage.setItem('kadare_role', 'student')
    setPwInput('')
    setPwError(null)
    return
  }

function handleLogout() {
  sessionStorage.removeItem('kadare_role')
  sessionStorage.removeItem('kadare_student_id')
  sessionStorage.removeItem('kadare_group_view')
  sessionStorage.removeItem('kadare_my_posts')
  sessionStorage.removeItem('kadare_liked_posts')

  setRole(null)
  setStudentId('')
  setGroupView(null)
  setPwInput('')
  setPwError(null)
  setMyPostIds([])
  setLikedPostIds([])
  setScreen('home')
}

 if (role === 'student' && VALID_IDS.includes(pwInput.toUpperCase())) {
  const id = VALID_IDS.find(x => x.toLowerCase() === pwInput.toLowerCase())!

  setStudentId(id)
  sessionStorage.setItem('kadare_student_id', id)
  return
}

  const grp = Object.entries(GROUP_PASSWORDS).find(([, pw]) => pw === pwInput)?.[0]
  if (grp) {
    setRole('group')
    setGroupView(grp)
    sessionStorage.setItem('kadare_role', 'group')
    sessionStorage.setItem('kadare_group_view', grp)
    return
  }

  setPwError('パスワードまたは学籍番号が正しくありません')
}

  async function handlePhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    const remaining = MAX_PHOTOS - photoFiles.length
    const toAdd = files.slice(0, remaining)
    const compressed = await Promise.all(toAdd.map(compressImage))
    setPhotoFiles(prev => [...prev, ...compressed])
    setPhotoPreviews(prev => [...prev, ...compressed.map(f => URL.createObjectURL(f))])
  }

  function removePhoto(i: number) {
    setPhotoFiles(prev => prev.filter((_,idx) => idx !== i))
    setPhotoPreviews(prev => prev.filter((_,idx) => idx !== i))
  }

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio:true})
      const mimeType = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' :
                       MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
      const mr = new MediaRecorder(stream, mimeType ? {mimeType} : {})
      chunksRef.current = []
      mr.ondataavailable = (e) => chunksRef.current.push(e.data)
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, {type: mimeType || 'audio/webm'})
        setAudioBlob(blob); setAudioURL(URL.createObjectURL(blob))
        stream.getTracks().forEach(t=>t.stop())
      }
      mr.start(); mediaRecRef.current = mr
      setIsRecording(true); setRecSec(0)
      timerRef.current = setInterval(()=>setRecSec(s=>s+1),1000)
    } catch(e) { alert('マイクへのアクセスを許可してください') }
  }

  function stopRec() {
    mediaRecRef.current?.stop()
    if(timerRef.current) clearInterval(timerRef.current)
    setIsRecording(false)
  }

  async function handleSubmit() {
    if(!group||!photoFiles.length||!studentName) { alert('名前・グループ・写真は必須です'); return }
    setSubmitting(true); setSubmitProgress(0)
    const newIds = [...myPostIds]
    try {
      for(let i = 0; i < photoFiles.length; i++) {
        const photoFile = photoFiles[i]
        const photoExt = photoFile.name.split('.').pop() || 'jpg'
        const photoPath = `photos/${Date.now()}_${i}.${photoExt}`
        await supabase.storage.from('Kadare').upload(photoPath, photoFile)
        const { data: photoData } = supabase.storage.from('Kadare').getPublicUrl(photoPath)

        let audioPublicUrl = null
        if(audioBlob && i === 0) {
          const audioExt = audioBlob.type.includes('mp4') ? 'm4a' : 'webm'
          const audioPath = `audio/${Date.now()}.${audioExt}`
          await supabase.storage.from('Kadare').upload(audioPath, audioBlob, {contentType: audioBlob.type})
          const { data: audioData } = supabase.storage.from('Kadare').getPublicUrl(audioPath)
          audioPublicUrl = audioData.publicUrl
        }

        const { data: inserted } = await supabase.from('posts').insert({
          group_name:group, comment: i===0 ? comment : '',
          photo_url:photoData.publicUrl,
          audio_url: i===0 ? audioPublicUrl : null,
          student_name:studentName
        }).select().single()

        if(inserted) newIds.push(inserted.id)
        setSubmitProgress(Math.round((i+1)/photoFiles.length*100))
      }
      setMyPostIds(newIds)
      sessionStorage.setItem('kadare_my_posts', JSON.stringify(newIds))
      setGroup(''); setComment(''); setStudentName('')
      setPhotoFiles([]); setPhotoPreviews([])
      setAudioBlob(null); setAudioURL(null)
      alert(`${photoFiles.length}枚投稿しました！`)
      setScreen('gallery')
    } catch(e) { alert('エラーが発生しました') }
    setSubmitting(false); setSubmitProgress(0)
  }

  async function handleDelete(post: Post) {
    if(!confirm('この投稿を削除しますか？')) return
    try {
      await supabase.from('posts').delete().eq('id', post.id)
      const photoPath = decodeURIComponent(post.photo_url.split('/object/public/Kadare/')[1]?.split('?')[0] || '')
      if(photoPath) await supabase.storage.from('Kadare').remove([photoPath])
      if(post.audio_url) {
        const audioPath = decodeURIComponent(post.audio_url.split('/object/public/Kadare/')[1]?.split('?')[0] || '')
        if(audioPath) await supabase.storage.from('Kadare').remove([audioPath])
      }
      const newIds = myPostIds.filter(id => id !== post.id)
      setMyPostIds(newIds)
      sessionStorage.setItem('kadare_my_posts', JSON.stringify(newIds))
      setSelected(null); loadPosts()
    } catch(e) { alert('削除に失敗しました') }
  }

  async function handleEdit(post: Post) {
    try {
      await supabase.from('posts').update({group_name: editGroup, comment: editComment}).eq('id', post.id)
      setEditing(false); setSelected(null); loadPosts()
    } catch(e) { alert('編集に失敗しました') }
  }

 async function handleLike(post: Post) {
  if (likedPostIds.includes(post.id)) return

  try {
    const newCount = (post.like_count || 0) + 1

    const { error } = await supabase
      .from('posts')
      .update({ like_count: newCount })
      .eq('id', post.id)

    if (error) {
      alert('いいねに失敗しました')
      return
    }

    const newLiked = [...likedPostIds, post.id]
    setLikedPostIds(newLiked)
    sessionStorage.setItem('kadare_liked_posts', JSON.stringify(newLiked))

    setPosts(prev =>
      prev.map(p =>
        p.id === post.id ? { ...p, like_count: newCount } : p
      )
    )

    if (selected && selected.id === post.id) {
      setSelected({ ...selected, like_count: newCount })
    }
  } catch (e) {
    alert('いいねに失敗しました')
  }
}
  
  async function handleDownloadZip() {
    if(filtered.length === 0) { alert('ダウンロードする投稿がありません'); return }
    setDownloading(true)
    try {
      const zip = new JSZip()
      await Promise.all(filtered.map(async (p, i) => {
        const res = await fetch(p.photo_url)
        const blob = await res.blob()
        const ext = p.photo_url.split('.').pop()?.split('?')[0] || 'jpg'
        const name = p.student_name || '不明'
        const label = `${String(i+1).padStart(3,'0')}_${p.group_name}班_${name}`
        zip.file(`${label}.${ext}`, blob)
        if(p.audio_url) {
          const ares = await fetch(p.audio_url)
          const ablob = await ares.blob()
          const aext = p.audio_url.split('.').pop()?.split('?')[0] || 'webm'
          zip.file(`${label}_音声.${aext}`, ablob)
        }
      }))
      const content = await zip.generateAsync({type:'blob'})
      const url = URL.createObjectURL(content)
      const a = document.createElement('a')
      a.href = url
      a.download = `PhotoVox_${filterGroup==='ALL'?'全班':filterGroup+'班'}.zip`
      a.click(); URL.revokeObjectURL(url)
    } catch(e) { alert('ダウンロードに失敗しました') }
    setDownloading(false)
  }

  const visiblePosts = role === 'teacher' ? posts
    : role === 'group' ? posts.filter(p => p.group_name === groupView)
    : posts.filter(p => myPostIds.includes(p.id))
  const filtered = visiblePosts.filter(p => filterGroup==='ALL' || p.group_name===filterGroup)

  if(!role) return (
    <div style={{minHeight:'100vh',background:'#f5f0e8',display:'flex',justifyContent:'center',alignItems:'center',fontFamily:'Georgia,serif'}}>
      <div style={{background:'#fff',padding:'40px 32px',borderRadius:8,width:'100%',maxWidth:360,boxShadow:'0 2px 12px rgba(0,0,0,0.1)'}}>
        <div style={{fontSize:28,fontWeight:700,marginBottom:8,textAlign:'center'}}>◎ PhotoVox</div>
        <p style={{textAlign:'center',color:'#666',fontSize:13,marginBottom:24}}>秋田県立大学カダーレ建築見学</p>
        <label style={{display:'block',fontSize:12,fontWeight:700,letterSpacing:1,marginBottom:8}}>パスワード</label>
        <input type="password" value={pwInput} onChange={e=>setPwInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} placeholder="入力してください" style={{width:'100%',border:`2px solid ${pwError?'#c0392b':'#ccc'}`,borderRadius:4,padding:'12px',fontSize:16,boxSizing:'border-box',marginBottom:8}} />
        {pwError && <p style={{color:'#c0392b',fontSize:12,marginBottom:8}}>パスワードが違います</p>}
        <button onClick={handleLogin} style={{background:'#1a1a1a',color:'#fff',border:'none',padding:'14px',fontSize:15,borderRadius:4,cursor:'pointer',width:'100%',fontWeight:700,marginTop:8}}>入る →</button>
      </div>
    </div>
  )
if (role === 'student' && !studentId) return (
  <div style={{ minHeight:'100vh', background:'#f5f0e8', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
    <div style={{ background:'#fff', padding:'40px 32px', borderRadius:20, width:'100%', maxWidth:420, boxShadow:'0 10px 30px rgba(0,0,0,.08)' }}>
      <div style={{ fontSize:28, fontWeight:700, marginBottom:12, textAlign:'center' }}>学籍番号を入力してください</div>

      <label style={{ display:'block', fontSize:12, fontWeight:700, marginBottom:8 }}>学籍番号</label>
      <input
        value={pwInput}
        onChange={(e)=>setPwInput(e.target.value)}
        placeholder="（例）B28C001"
        style={{
          width:'100%',
          padding:'14px 16px',
          border:'1px solid #ddd',
          borderRadius:12,
          fontSize:16,
          marginBottom:16
        }}
      />

      {pwError && <p style={{ color:'#c0392b', fontSize:14, marginBottom:12 }}>{pwError}</p>}

      <button
        onClick={handleLogin}
        style={{
          width:'100%',
          padding:'14px 16px',
          border:'none',
          borderRadius:12,
          background:'#333',
          color:'#fff',
          fontSize:16,
          fontWeight:700,
          cursor:'pointer'
        }}
      >
        進む
      </button>
    </div>
  </div>
)
  return (
    <div style={{minHeight:'100vh',background:'#f5f0e8',fontFamily:'Georgia,serif',color:'#1a1a1a'}}>
      <header style={{background:'#1a1a1a',position:'sticky',top:0,zIndex:100}}>
        <div style={{maxWidth:680,margin:'0 auto',padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <button onClick={()=>setScreen('home')} style={{background:'none',border:'none',cursor:'pointer',color:'#fff',fontSize:18,fontWeight:700,letterSpacing:2}}>◎ PhotoVox</button>
          <nav style={{display:'flex',gap:8,alignItems:'center'}}>
            {role==='teacher' && <span style={{color:'#c9963a',fontSize:11,border:'1px solid #c9963a',padding:'2px 8px',borderRadius:10}}>教員</span>}
            {role==='group' && <span style={{color:'#6b9e5e',fontSize:11,border:'1px solid #6b9e5e',padding:'2px 8px',borderRadius:10}}>{groupView}班</span>}
            <button onClick={()=>setScreen('upload')} style={{background:screen==='upload'?'#c9963a':'none',border:'1px solid #444',color:'#ccc',padding:'6px 14px',borderRadius:20,cursor:'pointer',fontSize:13}}>投稿</button>
            <button onClick={()=>setScreen('gallery')} style={{background:screen==='gallery'?'#c9963a':'none',border:'1px solid #444',color:'#ccc',padding:'6px 14px',borderRadius:20,cursor:'pointer',fontSize:13}}>ギャラリー</button>
          <button
  onClick={handleLogout}
  style={{
    background:'none',
    border:'1px solid #666',
    color:'#ccc',
    padding:'6px 14px',
    borderRadius:20,
    cursor:'pointer',
    fontSize:13
  }}
>
  ログアウト
</button>
          
          </nav>
        </div>
      </header>

      <main style={{maxWidth:680,margin:'0 auto',padding:'24px 16px 80px'}}>
        {screen==='home' && (
          <div style={{paddingTop:24}}>
            <div style={{fontSize:36,fontWeight:700,lineHeight:1.3,marginBottom:16}}>カダーレで<br/>みつけたものを<br/>声にする</div>
            <p style={{fontSize:14,lineHeight:1.8,color:'#555',marginBottom:32}}>写真を撮り、その場で音声コメントを録音して投稿しよう。<br/>5/26のワールドカフェで使う発表素材になります。</p>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <button onClick={()=>setScreen('upload')} style={{background:'#1a1a1a',color:'#fff',border:'none',padding:'16px 24px',fontSize:15,borderRadius:4,cursor:'pointer',fontWeight:700}}>📷　写真を投稿する</button>
              <button onClick={()=>setScreen('gallery')} style={{background:'none',color:'#1a1a1a',border:'2px solid #1a1a1a',padding:'14px 24px',fontSize:14,borderRadius:4,cursor:'pointer'}}>
                {role==='teacher'?'みんなの投稿を見る →':role==='group'?`${groupView}班の投稿を見る →`:'自分の投稿を見る →'}
              </button>
            </div>
          </div>
        )}

        {screen==='upload' && (
          <div>
            <h2 style={{fontSize:22,fontWeight:700,marginBottom:24,borderBottom:'2px solid #1a1a1a',paddingBottom:8}}>新しい投稿</h2>
            <label style={{display:'block',fontSize:13,fontWeight:700,letterSpacing:1,marginBottom:8,marginTop:20}}>名前 <span style={{background:'#d4722a',color:'#fff',fontSize:10,padding:'2px 6px',borderRadius:3}}>必須</span></label>
            <input value={studentName} onChange={e=>setStudentName(e.target.value)} placeholder="例：山田太郎" style={{width:'100%',border:'2px solid #ccc',borderRadius:4,padding:'12px',fontSize:14,boxSizing:'border-box'}} />
            <label style={{display:'block',fontSize:13,fontWeight:700,letterSpacing:1,marginBottom:8,marginTop:20}}>グループ <span style={{background:'#d4722a',color:'#fff',fontSize:10,padding:'2px 6px',borderRadius:3}}>必須</span></label>
            <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
              {GROUPS.map(g=><button key={g} onClick={()=>setGroup(g)} style={{background:group===g?'#1a1a1a':'#fff',color:group===g?'#fff':'#1a1a1a',border:'2px solid #ccc',padding:'8px 14px',borderRadius:4,cursor:'pointer'}}>{g}班</button>)}
            </div>
            <label style={{display:'block',fontSize:13,fontWeight:700,letterSpacing:1,marginBottom:8,marginTop:20}}>
              写真 <span style={{background:'#d4722a',color:'#fff',fontSize:10,padding:'2px 6px',borderRadius:3}}>必須</span>
              <span style={{color:'#999',fontSize:11,marginLeft:8}}>最大{MAX_PHOTOS}枚（{photoFiles.length}/{MAX_PHOTOS}）</span>
            </label>
            {photoPreviews.length > 0 && (
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:8}}>
                {photoPreviews.map((src,i)=>(
                  <div key={i} style={{position:'relative'}}>
                    <img src={src} style={{width:'100%',aspectRatio:'1/1',objectFit:'cover',borderRadius:4}} alt="" />
                    <button onClick={()=>removePhoto(i)} style={{position:'absolute',top:4,right:4,background:'rgba(0,0,0,0.6)',color:'#fff',border:'none',width:24,height:24,borderRadius:'50%',cursor:'pointer',fontSize:12}}>✕</button>
                  </div>
                ))}
              </div>
            )}
            {photoFiles.length < MAX_PHOTOS && (
              <div style={{display:'flex',gap:8}}>
                <label style={{flex:1,background:'#1a1a1a',color:'#fff',padding:'12px',borderRadius:4,cursor:'pointer',textAlign:'center',fontSize:13,fontWeight:700,display:'block'}}>
                  📷 カメラで撮る
                  <input type="file" accept="image/*" capture="environment" onChange={handlePhotos} style={{display:'none'}} multiple />
                </label>
                <label style={{flex:1,background:'#fff',color:'#1a1a1a',padding:'12px',borderRadius:4,cursor:'pointer',textAlign:'center',fontSize:13,fontWeight:700,border:'2px solid #1a1a1a',display:'block'}}>
                  🖼 ギャラリーから選ぶ
                  <input type="file" accept="image/*" onChange={handlePhotos} style={{display:'none'}} multiple />
                </label>
              </div>
            )}
            <label style={{display:'block',fontSize:13,fontWeight:700,letterSpacing:1,marginBottom:8,marginTop:20}}>音声コメント <span style={{background:'#aaa',color:'#fff',fontSize:10,padding:'2px 6px',borderRadius:3}}>任意・1枚目に添付</span></label>
            {!audioURL ? (
              <button onClick={isRecording?stopRec:startRec} style={{background:isRecording?'#c0392b':'#fff',color:isRecording?'#fff':'#1a1a1a',border:'2px solid #1a1a1a',padding:'14px 20px',borderRadius:4,fontSize:14,cursor:'pointer',width:'100%'}}>
                {isRecording?`⏹ 録音停止 ${formatTime(recSec)}`:'🎙 録音開始'}
              </button>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <audio src={audioURL} controls style={{width:'100%'}} />
                <button onClick={()=>{setAudioBlob(null);setAudioURL(null)}} style={{background:'none',border:'1px solid #ccc',padding:'6px 12px',borderRadius:4,cursor:'pointer',fontSize:12,alignSelf:'flex-start'}}>✕ 録り直す</button>
              </div>
            )}
            <label style={{display:'block',fontSize:13,fontWeight:700,letterSpacing:1,marginBottom:8,marginTop:20}}>テキストメモ <span style={{background:'#aaa',color:'#fff',fontSize:10,padding:'2px 6px',borderRadius:3}}>任意・1枚目に添付</span></label>
            <textarea value={comment} onChange={e=>setComment(e.target.value)} rows={3} placeholder="気づいたこと、疑問など…" style={{width:'100%',border:'2px solid #ccc',borderRadius:4,padding:'12px',fontSize:14,resize:'vertical',boxSizing:'border-box'}} />
            {submitting && (
              <div style={{marginTop:16,background:'#eee',borderRadius:4,overflow:'hidden'}}>
                <div style={{background:'#4a87b8',height:8,width:`${submitProgress}%`,transition:'width 0.3s'}} />
                <p style={{textAlign:'center',fontSize:12,color:'#666',marginTop:4}}>{submitProgress}% 投稿中…</p>
              </div>
            )}
            <button onClick={handleSubmit} disabled={submitting} style={{background:'#1a1a1a',color:'#fff',border:'none',padding:'16px 24px',fontSize:15,borderRadius:4,cursor:'pointer',fontWeight:700,width:'100%',marginTop:16}}>
              {submitting?'投稿中…':`投稿する（${photoFiles.length}枚）→`}
            </button>
          </div>
        )}

        {screen==='gallery' && (
          <div>
            <h2 style={{fontSize:22,fontWeight:700,marginBottom:16,borderBottom:'2px solid #1a1a1a',paddingBottom:8}}>
              {role==='teacher'?'みんなの投稿':role==='group'?`${groupView}班の投稿`:'自分の投稿'}
            </h2>
            {role==='teacher' && (
              <>
                <div style={{display:'flex',gap:8,marginBottom:12}}>
                  <select value={filterGroup} onChange={e=>setFilterGroup(e.target.value)} style={{flex:1,border:'2px solid #ccc',padding:'8px 12px',borderRadius:4,fontSize:13}}>
                    <option value="ALL">全グループ</option>
                    {GROUPS.map(g=><option key={g} value={g}>{g}班</option>)}
                  </select>
                </div>
                <button onClick={handleDownloadZip} disabled={downloading} style={{background:'#4a87b8',color:'#fff',border:'none',padding:'10px 16px',borderRadius:4,cursor:'pointer',fontSize:13,width:'100%',marginBottom:16,fontWeight:700}}>
                  {downloading?'準備中…':`📦 表示中の${filtered.length}件をZIPダウンロード`}
                </button>
              </>
            )}
            {filtered.length===0 ? <p style={{textAlign:'center',color:'#999',marginTop:40}}>投稿がありません</p> : (
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12}}>
                {filtered.map(p=>(
                  <div key={p.id} onClick={()=>{setSelected(p);setEditing(false);setEditComment(p.comment||'');setEditGroup(p.group_name)}} style={{background:'#fff',borderRadius:4,overflow:'hidden',cursor:'pointer',boxShadow:'0 1px 4px rgba(0,0,0,0.1)'}}>
                    <img src={p.photo_url} style={{width:'100%',aspectRatio:'1/1',objectFit:'cover'}} alt="" />
                    <div style={{padding:'10px 12px'}}>
                      <div style={{display:'flex',gap:6,marginBottom:6,flexWrap:'wrap'}}>
                        <span style={{background:'#1a1a1a',color:'#fff',fontSize:11,padding:'2px 7px',borderRadius:3,fontWeight:700}}>{p.group_name}班</span>
                        {p.student_name && <span style={{background:'#eee',color:'#555',fontSize:11,padding:'2px 7px',borderRadius:3}}>{p.student_name}</span>}
                      </div>
                      {p.comment && <p style={{fontSize:12,color:'#444',lineHeight:1.5,marginBottom:4}}>{p.comment}</p>}
                      {p.audio_url && <span style={{fontSize:11,color:'#4a87b8'}}>🎙 音声あり</span>}
                    </div>
                    <div style={{marginTop:8, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
<button
  onClick={(e) => {
    e.stopPropagation()
    handleLike(p)
  }}
  disabled={likedPostIds.includes(p.id)}
  style={{
    background: likedPostIds.includes(p.id) ? '#ddd' : '#fff',
    color: likedPostIds.includes(p.id) ? '#777' : '#1a1a1a',
    border: '1px solid #ccc',
    padding: '6px 10px',
    borderRadius: 20,
    cursor: likedPostIds.includes(p.id) ? 'default' : 'pointer',
    fontSize: 12
  }}
>
  {likedPostIds.includes(p.id) ? '♥ いいね済み' : '♡ いいね'}
</button>

  <span style={{fontSize:12, color:'#666'}}>
    ♥ {p.like_count || 0}
  </span>
</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {selected && (
        <div onClick={()=>{setSelected(null);setEditing(false)}} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:200,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <div onClick={e=>e.stopPropagation()} style={{background:'#fff',width:'100%',maxWidth:600,maxHeight:'90vh',overflowY:'auto',borderRadius:'12px 12px 0 0',position:'relative'}}>
            <button onClick={()=>{setSelected(null);setEditing(false)}} style={{position:'absolute',top:12,right:12,background:'#eee',border:'none',width:32,height:32,borderRadius:'50%',cursor:'pointer',fontSize:16,zIndex:1}}>✕</button>
            <img src={selected.photo_url} style={{width:'100%',aspectRatio:'4/3',objectFit:'cover'}} alt="" />
            <div style={{padding:16}}>
              {editing ? (
                <div>
                  <label style={{display:'block',fontSize:12,fontWeight:700,marginBottom:6}}>グループ</label>
                  <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:12}}>
                    {GROUPS.map(g=><button key={g} onClick={()=>setEditGroup(g)} style={{background:editGroup===g?'#1a1a1a':'#fff',color:editGroup===g?'#fff':'#1a1a1a',border:'2px solid #ccc',padding:'6px 12px',borderRadius:4,cursor:'pointer',fontSize:12}}>{g}班</button>)}
                  </div>
                  <label style={{display:'block',fontSize:12,fontWeight:700,marginBottom:6}}>テキストメモ</label>
                  <textarea value={editComment} onChange={e=>setEditComment(e.target.value)} rows={3} style={{width:'100%',border:'2px solid #ccc',borderRadius:4,padding:'10px',fontSize:14,resize:'vertical',boxSizing:'border-box',marginBottom:12}} />
                  <div style={{display:'flex',gap:8}}>
                    <button onClick={()=>handleEdit(selected)} style={{flex:1,background:'#1a1a1a',color:'#fff',border:'none',padding:'10px',borderRadius:4,cursor:'pointer',fontSize:14}}>保存する</button>
                    <button onClick={()=>setEditing(false)} style={{flex:1,background:'#eee',color:'#333',border:'none',padding:'10px',borderRadius:4,cursor:'pointer',fontSize:14}}>キャンセル</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap'}}>
                    <span style={{background:'#1a1a1a',color:'#fff',fontSize:11,padding:'2px 7px',borderRadius:3,fontWeight:700}}>{selected.group_name}班</span>
                    {selected.student_name && <span style={{background:'#eee',color:'#555',fontSize:11,padding:'2px 7px',borderRadius:3}}>{selected.student_name}</span>}
                  </div>
                  {selected.audio_url && <audio src={selected.audio_url} controls style={{width:'100%',marginBottom:12}} />}
                  {selected.comment && <p style={{fontSize:14,lineHeight:1.7,color:'#333',marginBottom:12}}>{selected.comment}</p>}
                  {(role==='teacher' || myPostIds.includes(selected.id)) && (
                    <div style={{display:'flex',gap:8}}>
                      {myPostIds.includes(selected.id) && (
                        <button onClick={()=>setEditing(true)} style={{flex:1,background:'#4a87b8',color:'#fff',border:'none',padding:'10px',borderRadius:4,cursor:'pointer',fontSize:14}}>✏️ 編集</button>
                      )}
                      <button onClick={()=>handleDelete(selected)} style={{flex:1,background:'#c0392b',color:'#fff',border:'none',padding:'10px',borderRadius:4,cursor:'pointer',fontSize:14}}>🗑 削除</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
