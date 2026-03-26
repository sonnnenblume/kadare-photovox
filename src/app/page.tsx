'use client'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import JSZip from 'jszip'

const GROUPS = ['A','B','C','D','E','F','G','H']
const THEMES = ['構造','材料','環境','計画','意匠']
const THEME_COLOR: Record<string,string> = {構造:'#d4722a',材料:'#6b9e5e',環境:'#4a87b8',計画:'#8b67a8',意匠:'#c9963a'}
const STUDENT_PASSWORD = '0519'
const TEACHER_PASSWORD = '0526'

type Post = { id: number; created_at: string; group_name: string; theme: string; comment: string; photo_url: string; audio_url: string | null; student_name: string | null }
type Role = 'student' | 'teacher'

function formatTime(sec: number) {
  return `${Math.floor(sec/60).toString().padStart(2,'0')}:${(sec%60).toString().padStart(2,'0')}`
}

export default function Home() {
  const [role, setRole] = useState<Role|null>(null)
  const [pwInput, setPwInput] = useState('')
  const [pwError, setPwError] = useState(false)
  const [screen, setScreen] = useState<'home'|'upload'|'gallery'>('home')
  const [posts, setPosts] = useState<Post[]>([])
  const [group, setGroup] = useState('')
  const [theme, setTheme] = useState('')
  const [comment, setComment] = useState('')
  const [studentName, setStudentName] = useState('')
  const [photoFile, setPhotoFile] = useState<File|null>(null)
  const [photoPreview, setPhotoPreview] = useState<string|null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob|null>(null)
  const [audioURL, setAudioURL] = useState<string|null>(null)
  const [recSec, setRecSec] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [selected, setSelected] = useState<Post|null>(null)
  const [filterGroup, setFilterGroup] = useState('ALL')
  const [filterTheme, setFilterTheme] = useState('ALL')
  const [myPostIds, setMyPostIds] = useState<number[]>([])
  const mediaRecRef = useRef<MediaRecorder|null>(null)
  const timerRef = useRef<NodeJS.Timeout|null>(null)
  const chunksRef = useRef<Blob[]>([])

  useEffect(() => {
    const savedRole
cat > src/app/page.tsx << 'ENDOFFILE'
'use client'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import JSZip from 'jszip'

const GROUPS = ['A','B','C','D','E','F','G','H']
const THEMES = ['構造','材料','環境','計画','意匠']
const THEME_COLOR: Record<string,string> = {構造:'#d4722a',材料:'#6b9e5e',環境:'#4a87b8',計画:'#8b67a8',意匠:'#c9963a'}
const STUDENT_PASSWORD = '0519'
const TEACHER_PASSWORD = '0526'

type Post = { id: number; created_at: string; group_name: string; theme: string; comment: string; photo_url: string; audio_url: string | null; student_name: string | null }
type Role = 'student' | 'teacher'

function formatTime(sec: number) {
  return `${Math.floor(sec/60).toString().padStart(2,'0')}:${(sec%60).toString().padStart(2,'0')}`
}

export default function Home() {
  const [role, setRole] = useState<Role|null>(null)
  const [pwInput, setPwInput] = useState('')
  const [pwError, setPwError] = useState(false)
  const [screen, setScreen] = useState<'home'|'upload'|'gallery'>('home')
  const [posts, setPosts] = useState<Post[]>([])
  const [group, setGroup] = useState('')
  const [theme, setTheme] = useState('')
  const [comment, setComment] = useState('')
  const [studentName, setStudentName] = useState('')
  const [photoFile, setPhotoFile] = useState<File|null>(null)
  const [photoPreview, setPhotoPreview] = useState<string|null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob|null>(null)
  const [audioURL, setAudioURL] = useState<string|null>(null)
  const [recSec, setRecSec] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [selected, setSelected] = useState<Post|null>(null)
  const [filterGroup, setFilterGroup] = useState('ALL')
  const [filterTheme, setFilterTheme] = useState('ALL')
  const [myPostIds, setMyPostIds] = useState<number[]>([])
  const mediaRecRef = useRef<MediaRecorder|null>(null)
  const timerRef = useRef<NodeJS.Timeout|null>(null)
  const chunksRef = useRef<Blob[]>([])

  useEffect(() => {
    const savedRole = sessionStorage.getItem('kadare_role') as Role|null
    if(savedRole) setRole(savedRole)
    const ids = JSON.parse(sessionStorage.getItem('kadare_my_posts') || '[]')
    setMyPostIds(ids)
  }, [])

  useEffect(() => { if(screen==='gallery') loadPosts() }, [screen])

  async function loadPosts() {
    const { data } = await supabase.from('posts').select('*').order('created_at',{ascending:false})
    if(data) setPosts(data)
  }

  function handleLogin() {
    if(pwInput === TEACHER_PASSWORD) {
      setRole('teacher')
      sessionStorage.setItem('kadare_role', 'teacher')
      setPwError(false)
    } else if(pwInput === STUDENT_PASSWORD) {
      setRole('student')
      sessionStorage.setItem('kadare_role', 'student')
      setPwError(false)
    } else {
      setPwError(true)
    }
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if(!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio:true})
      const mimeType = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' :
                       MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
      const mr = new MediaRecorder(stream, mimeType ? {mimeType} : {})
      chunksRef.current = []
      mr.ondataavailable = e => chunksRef.current.push(e.data)
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, {type: mimeType || 'audio/webm'})
        setAudioBlob(blob)
        setAudioURL(URL.createObjectURL(blob))
        stream.getTracks().forEach(t=>t.stop())
      }
      mr.start()
      mediaRecRef.current = mr
      setIsRecording(true)
      setRecSec(0)
      timerRef.current = setInterval(()=>setRecSec(s=>s+1),1000)
    } catch(e) {
      alert('マイクへのアクセスを許可してください')
    }
  }

  function stopRec() {
    mediaRecRef.current?.stop()
    if(timerRef.current) clearInterval(timerRef.current)
    setIsRecording(false)
  }

  async function handleSubmit() {
    if(!group||!theme||!photoFile||!studentName) { alert('名前・グループ・テーマ・写真は必須です'); return }
    setSubmitting(true)
    try {
      const photoExt = photoFile.name.split('.').pop() || 'jpg'
      const photoPath = `photos/${Date.now()}.${photoExt}`
      await supabase.storage.from('Kadare').upload(photoPath, photoFile)
      const { data: photoData } = supabase.storage.from('Kadare').getPublicUrl(photoPath)

      let audioPublicUrl = null
      if(audioBlob) {
        const audioExt = audioBlob.type.includes('mp4') ? 'm4a' : 'webm'
        const audioPath = `audio/${Date.now()}.${audioExt}`
        await supabase.storage.from('Kadare').upload(audioPath, audioBlob, {contentType: audioBlob.type})
        const { data: audioData } = supabase.storage.from('Kadare').getPublicUrl(audioPath)
        audioPublicUrl = audioData.publicUrl
      }

      const { data: inserted } = await supabase.from('posts').insert({
        group_name:group, theme, comment,
        photo_url:photoData.publicUrl,
        audio_url:audioPublicUrl,
        student_name:studentName
      }).select().single()

      if(inserted) {
        const newIds = [...myPostIds, inserted.id]
        setMyPostIds(newIds)
        sessionStorage.setItem('kadare_my_posts', JSON.stringify(newIds))
      }

      setGroup(''); setTheme(''); setComment(''); setStudentName('')
      setPhotoFile(null); setPhotoPreview(null)
      setAudioBlob(null); setAudioURL(null)
      alert('投稿しました！')
      setScreen('gallery')
    } catch(e) { alert('エラーが発生しました') }
    setSubmitting(false)
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
      setSelected(null)
      loadPosts()
    } catch(e) { alert('削除に失敗しました') }
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
        const label = `${String(i+1).padStart(3,'0')}_${p.group_name}班_${p.theme}_${name}`
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
      const label = [filterGroup!=='ALL'?`${filterGroup}班`:'全班', filterTheme!=='ALL'?filterTheme:'全テーマ'].join('_')
      a.download = `PhotoVox_${label}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch(e) { alert('ダウンロードに失敗しました') }
    setDownloading(false)
  }

  const visiblePosts = role === 'teacher' ? posts : posts.filter(p => myPostIds.includes(p.id))
  const filtered = visiblePosts.filter(p=>(filterGroup==='ALL'||p.group_name===filterGroup)&&(filterTheme==='ALL'||p.theme===filterTheme))

  if(!role) return (
    <div style={{minHeight:'100vh',background:'#f5f0e8',display:'flex',justifyContent:'center',alignItems:'center',fontFamily:'Georgia,serif'}}>
      <div style={{background:'#fff',padding:'40px 32px',borderRadius:8,width:'100%',maxWidth:360,boxShadow:'0 2px 12px rgba(0,0,0,0.1)'}}>
        <div style={{fontSize:28,fontWeight:700,marginBottom:8,textAlign:'center'}}>◎ PhotoVox</div>
        <p style={{textAlign:'center',color:'#666',fontSize:13,marginBottom:24}}>カダーレ建築観察</p>
        <label style={{display:'block',fontSize:12,fontWeight:700,letterSpacing:1,marginBottom:8}}>パスワード</label>
        <input type="password" value={pwInput} onChange={e=>setPwInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} placeholder="入力してください" style={{width:'100%',border:`2px solid ${pwError?'#c0392b':'#ccc'}`,borderRadius:4,padding:'12px',fontSize:16,boxSizing:'border-box',marginBottom:8}} />
        {pwError && <p style={{color:'#c0392b',fontSize:12,marginBottom:8}}>パスワードが違います</p>}
        <button onClick={handleLogin} style={{background:'#1a1a1a',color:'#fff',border:'none',padding:'14px',fontSize:15,borderRadius:4,cursor:'pointer',width:'100%',fontWeight:700,marginTop:8}}>入る →</button>
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
            <button onClick={()=>setScreen('upload')} style={{background:screen==='upload'?'#c9963a':'none',border:'1px solid #444',color:'#ccc',padding:'6px 14px',borderRadius:20,cursor:'pointer',fontSize:13}}>投稿</button>
            <button onClick={()=>setScreen('gallery')} style={{background:screen==='gallery'?'#c9963a':'none',border:'1px solid #444',color:'#ccc',padding:'6px 14px',borderRadius:20,cursor:'pointer',fontSize:13}}>ギャラリー</button>
          </nav>
        </div>
      </header>

      <main style={{maxWidth:680,margin:'0 auto',padding:'24px 16px 80px'}}>
        {screen==='home' && (
          <div style={{paddingTop:24}}>
            <div style={{fontSize:36,fontWeight:700,lineHeight:1.3,marginBottom:16}}>カダーレで<br/>みつけたものを<br/>声にする</div>
            <p style={{fontSize:14,lineHeight:1.8,color:'#555',marginBottom:32}}>写真を撮り、その場で音声コメントを録音して投稿しよう。<br/>5/26のワールドカフェで使う発表素材になります。</p>
            <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:32}}>
              <button onClick={()=>setScreen('upload')} style={{background:'#1a1a1a',color:'#fff',border:'none',padding:'16px 24px',fontSize:15,borderRadius:4,cursor:'pointer',fontWeight:700}}>📷　写真＋音声を投稿する</button>
              <button onClick={()=>setScreen('gallery')} style={{background:'none',color:'#1a1a1a',border:'2px solid #1a1a1a',padding:'14px 24px',fontSize:14,borderRadius:4,cursor:'pointer'}}>{role==='teacher'?'みんなの投稿を見る →':'自分の投稿を見る →'}</button>
            </div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {THEMES.map(t=><span key={t} style={{background:THEME_COLOR[t],color:'#fff',padding:'4px 12px',borderRadius:20,fontSize:12,fontWeight:700}}>{t}</span>)}
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
            <label style={{display:'block',fontSize:13,fontWeight:700,letterSpacing:1,marginBottom:8,marginTop:20}}>テーマ <span style={{background:'#d4722a',color:'#fff',fontSize:10,padding:'2px 6px',borderRadius:3}}>必須</span></label>
            <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
              {THEMES.map(t=><button key={t} onClick={()=>setTheme(t)} style={{background:theme===t?THEME_COLOR[t]:'#fff',color:theme===t?'#fff':'#1a1a1a',border:'2px solid #ccc',padding:'8px 14px',borderRadius:4,cursor:'pointer'}}>{t}</button>)}
            </div>
            <label style={{display:'block',fontSize:13,fontWeight:700,letterSpacing:1,marginBottom:8,marginTop:20}}>写真 <span style={{background:'#d4722a',color:'#fff',fontSize:10,padding:'2px 6px',borderRadius:3}}>必須</span></label>
            <label style={{display:'flex',justifyContent:'center',alignItems:'center',width:'100%',aspectRatio:'4/3',background:'#e8e0d0',border:'2px dashed #bbb',borderRadius:4,cursor:'pointer',overflow:'hidden'}}>
              {photoPreview ? <img src={photoPreview} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : <span style={{color:'#888',textAlign:'center'}}>＋ タップして写真を選ぶ</span>}
              <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{display:'none'}} />
            </label>
            <label style={{display:'block',fontSize:13,fontWeight:700,letterSpacing:1,marginBottom:8,marginTop:20}}>音声コメント <span style={{background:'#aaa',color:'#fff',fontSize:10,padding:'2px 6px',borderRadius:3}}>任意</span></label>
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
            <label style={{display:'block',fontSize:13,fontWeight:700,letterSpacing:1,marginBottom:8,marginTop:20}}>テキストメモ <span style={{background:'#aaa',color:'#fff',fontSize:10,padding:'2px 6px',borderRadius:3}}>任意</span></label>
            <textarea value={comment} onChange={e=>setComment(e.target.value)} rows={3} placeholder="気づいたこと、疑問など…" style={{width:'100%',border:'2px solid #ccc',borderRadius:4,padding:'12px',fontSize:14,resize:'vertical',boxSizing:'border-box'}} />
            <button onClick={handleSubmit} disabled={submitting} style={{background:'#1a1a1a',color:'#fff',border:'none',padding:'16px 24px',fontSize:15,borderRadius:4,cursor:'pointer',fontWeight:700,width:'100%',marginTop:24}}>
              {submitting?'投稿中…':'投稿する →'}
            </button>
          </div>
        )}

        {screen==='gallery' && (
          <div>
            <h2 style={{fontSize:22,fontWeight:700,marginBottom:16,borderBottom:'2px solid #1a1a1a',paddingBottom:8}}>{role==='teacher'?'みんなの投稿':'自分の投稿'}</h2>
            {role==='teacher' && (
              <>
                <div style={{display:'flex',gap:8,marginBottom:12}}>
                  <select value={filterGroup} onChange={e=>setFilterGroup(e.target.value)} style={{flex:1,border:'2px solid #ccc',padding:'8px 12px',borderRadius:4,fontSize:13}}>
                    <option value="ALL">全グループ</option>
                    {GROUPS.map(g=><option key={g} value={g}>{g}班</option>)}
                  </select>
                  <select value={filterTheme} onChange={e=>setFilterTheme(e.target.value)} style={{flex:1,border:'2px solid #ccc',padding:'8px 12px',borderRadius:4,fontSize:13}}>
                    <option value="ALL">全テーマ</option>
                    {THEMES.map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <button onClick={handleDownloadZip} disabled={downloading} style={{background:'#4a87b8',color:'#fff',border:'none',padding:'10px 16px',borderRadius:4,cursor:'pointer',fontSize:13,width:'100%',marginBottom:16,fontWeight:700}}>
                  {downloading?'準備中…':`📦 表示中の${filtered.length}件をZIPダウンロード`}
                </button>
              </>
            )}
            {filtered.length===0 ? <p style={{textAlign:'center',color:'#999',marginTop:40}}>{role==='student'?'まだ投稿がありません':'該当する投稿がありません'}</p> : (
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12}}>
                {filtered.map(p=>(
                  <div key={p.id} onClick={()=>setSelected(p)} style={{background:'#fff',borderRadius:4,overflow:'hidden',cursor:'pointer',boxShadow:'0 1px 4px rgba(0,0,0,0.1)'}}>
                    <img src={p.photo_url} style={{width:'100%',aspectRatio:'1/1',objectFit:'cover'}} alt="" />
                    <div style={{padding:'10px 12px'}}>
                      <div style={{display:'flex',gap:6,marginBottom:6,flexWrap:'wrap'}}>
                        <span style={{background:'#1a1a1a',color:'#fff',fontSize:11,padding:'2px 7px',borderRadius:3,fontWeight:700}}>{p.group_name}班</span>
                        <span style={{background:THEME_COLOR[p.theme],color:'#fff',fontSize:11,padding:'2px 7px',borderRadius:3,fontWeight:700}}>{p.theme}</span>
                        {p.student_name && <span style={{background:'#eee',color:'#555',fontSize:11,padding:'2px 7px',borderRadius:3}}>{p.student_name}</span>}
                      </div>
                      {p.comment && <p style={{fontSize:12,color:'#444',lineHeight:1.5,marginBottom:4}}>{p.comment}</p>}
                      {p.audio_url && <span style={{fontSize:11,color:'#4a87b8'}}>🎙 音声あり</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {selected && (
        <div onClick={()=>setSelected(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:200,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <div onClick={e=>e.stopPropagation()} style={{background:'#fff',width:'100%',maxWidth:600,maxHeight:'90vh',overflowY:'auto',borderRadius:'12px 12px 0 0',position:'relative'}}>
            <button onClick={()=>setSelected(null)} style={{position:'absolute',top:12,right:12,background:'#eee',border:'none',width:32,height:32,borderRadius:'50%',cursor:'pointer',fontSize:16,zIndex:1}}>✕</button>
            <img src={selected.photo_url} style={{width:'100%',aspectRatio:'4/3',objectFit:'cover'}} alt="" />
            <div style={{padding:16}}>
              <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap'}}>
                <span style={{background:'#1a1a1a',color:'#fff',fontSize:11,padding:'2px 7px',borderRadius:3,fontWeight:700}}>{selected.group_name}班</span>
                <span style={{background:THEME_COLOR[selected.theme],color:'#fff',fontSize:11,padding:'2px 7px',borderRadius:3,fontWeight:700}}>{selected.theme}</span>
                {selected.student_name && <span style={{background:'#eee',color:'#555',fontSize:11,padding:'2px 7px',borderRadius:3}}>{selected.student_name}</span>}
              </div>
              {selected.audio_url && <audio src={selected.audio_url} controls style={{width:'100%',marginBottom:12}} />}
              {selected.comment && <p style={{fontSize:14,lineHeight:1.7,color:'#333',marginBottom:12}}>{selected.comment}</p>}
              {(role==='teacher' || myPostIds.includes(selected.id)) && (
                <button onClick={()=>handleDelete(selected)} style={{background:'#c0392b',color:'#fff',border:'none',padding:'10px 20px',borderRadius:4,cursor:'pointer',fontSize:14,width:'100%'}}>
                  🗑 この投稿を削除する
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
