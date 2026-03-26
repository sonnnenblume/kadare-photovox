'use client'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const GROUPS = ['A','B','C','D','E','F','G','H']
const THEMES = ['構造','材料','環境','計画','意匠']
const THEME_COLOR: Record<string,string> = {構造:'#d4722a',材料:'#6b9e5e',環境:'#4a87b8',計画:'#8b67a8',意匠:'#c9963a'}
const PASSWORD = '0519'

type Post = { id: number; created_at: string; group_name: string; theme: string; comment: string; photo_url: string; audio_url: string | null }

function formatTime(sec: number) {
  return `${Math.floor(sec/60).toString().padStart(2,'0')}:${(sec%60).toString().padStart(2,'0')}`
}

export default function Home() {
  const [authed, setAuthed] = useState(false)
  const [pwInput, setPwInput] = useState('')
  const [pwError, setPwError] = useState(false)
  const [screen, setScreen] = useState<'home'|'upload'|'gallery'>('home')
  const [posts, setPosts] = useState<Post[]>([])
  const [group, setGroup] = useState('')
  const [theme, setTheme] = useState('')
  const [comment, setComment] = useState('')
  const [photoFile, setPhotoFile] = useState<File|null>(null)
  const [photoPreview, setPhotoPreview] = useState<string|null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob|null>(null)
  const [audioURL, setAudioURL] = useState<string|null>(null)
  const [recSec, setRecSec] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [selected, setSelected] = useState<Post|null>(null)
  const [filterGroup, setFilterGroup] = useState('ALL')
  const [filterTheme, setFilterTheme] = useState('ALL')
  const [myPostIds, setMyPostIds] = useState<number[]>([])
  const mediaRecRef = useRef<MediaRecorder|null>(null)
  const timerRef = useRef<NodeJS.Timeout|null>(null)
  const chunksRef = useRef<Blob[]>([])

  useEffect(() => {
    const saved = sessionStorage.getItem('kadare_auth')
    if(saved === PASSWORD) setAuthed(true)
    const ids = JSON.parse(sessionStorage.getItem('kadare_my_posts') || '[]')
    setMyPostIds(ids)
  }, [])

  useEffect(() => { if(screen==='gallery') loadPosts() }, [screen])

  async function loadPosts() {
    const { data } = await supabase.from('posts').select('*').order('created_at',{ascending:false})
    if(data) setPosts(data)
  }

  function handleLogin() {
    if(pwInput === PASSWORD) {
      setAuthed(true)
      sessionStorage.setItem('kadare_auth', PASSWORD)
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
    if(!group||!theme||!photoFile) { alert('グループ・テーマ・写真は必須です'); return }
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
        audio_url:audioPublicUrl
      }).select().single()

      if(inserted) {
        const newIds = [...myPostIds, inserted.id]
        setMyPostIds(newIds)
        sessionStorage.setItem('kadare_my_posts', JSON.stringify(newIds))
      }

      setGroup(''); setTheme(''); setComment('')
      setPhotoFile(null); setPhotoPreview(null)
      setAudioBlob(null); setAudioURL(null)
      setScreen('gallery')
    } catch(e) { alert('エラーが発生しました') }
    setSubmitting(false)
  }

  async function handleDelete(post: Post) {
    if(!confirm('この投稿を削除しますか？')) return
    await supabase.from('posts').delete().eq('id', post.id)
    const photoPath = post.photo_url.split('/Kadare/')[1]
    if(photoPath) await supabase.storage.from('Kadare').remove([photoPath])
    if(post.audio_url) {
      const audioPath = post.audio_url.split('/Kadare/')[1]
      if(audioPath) await supabase.storage.from('Kadare').remove([audioPath])
    }
    const newIds = myPostIds.filter(id => id !== post.id)
    setMyPostIds(newIds)
    sessionStorage.setItem('kadare_my_posts', JSON.stringify(newIds))
    setSelected(null)
    loadPosts()
  }

  const filtered = posts.filter(p=>(filterGroup==='ALL'||p.group_name===filterGroup)&&(filterTheme==='ALL'||p.theme===filterTheme))

  if(!authed) return (
    <div style={{minHeight:'100vh',background:'#f5f0e8',display:'flex',justifyContent:'center',alignItems:'center',fontFamily:'Georgia,serif'}}>
      <div style={{background:'#fff',padding:'40px 32px',borderRadius:8,width:'100%',maxWidth:360,boxShadow:'0 2px 12px rgba(0,0,0,0.1)'}}>
        <div style={{fontSize:28,fontWeight:700,marginBottom:8,textAlign:'center'}}>◎ PhotoVox</div>
        <p style={{textAlign:'center',color:'#666',fontSize:13,marginBottom:24}}>カダーレ建築観察</p>
        <label style={{display:'block',fontSize:12,fontWeight:700,letterSpacing:1,marginBottom:8}}>パスワード</label>
        <input 
          type="password" 
          value={pwInput} 
          onChange={e=>setPwInput(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&handleLogin()}
          placeholder="入力してください"
          style={{width:'100%',border:`2px solid ${pwError?'#c0392b':'#ccc'}`,borderRadius:4,padding:'12px',fontSize:16,boxSizing:'border-box',marginBottom:8}}
        />
        {pwError && <p style={{color:'#c0392b',fontSize:12,marginBottom:8}}>パスワードが違います</p>}
        <button onClick={handleLogin} style={{background:'#1a1a1a',color:'#fff',border:'none',padding:'14px',fontSize:15,borderRadius:4,cursor:'pointer',width:'100%',fontWeight:700,marginTop:8}}>
          入る →
        </button>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:'#f5f0e8',fontFamily:'Georgia,serif',color:'#1a1a1a'}}>
      <header style={{background:'#1a1a1a',position:'sticky',top:0,zIndex:100}}>
        <div style={{maxWidth:680,margin:'0 auto',padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <button onClick={()=>setScreen('home')} style={{background:'none',border:'none',cursor:'pointer',color:'#fff',fontSize:18,fontWeight:700,letterSpacing:2}}>◎ PhotoVox</button>
          <nav style={{display:'flex',gap:8}}>
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
              <button onClick={()=>setScreen('gallery')} style={{background:'none',color:'#1a1a1a',border:'2px solid #1a1a1a',padding:'14px 24px',fontSize:14,borderRadius:4,cursor:'pointer'}}>みんなの投稿を見る →</button>
            </div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {THEMES.map(t=><span key={t} style={{background:THEME_COLOR[t],color:'#fff',padding:'4px 12px',borderRadius:20,fontSize:12,fontWeight:700}}>{t}</span>)}
            </div>
          </div>
        )}

        {screen==='upload' && (
          <div>
            <h2 style={{fontSize:22,fontWeight:700,marginBottom:24,borderBottom:'2px solid #1a1a1a',paddingBottom:8}}>新しい投稿</h2>
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
            <h2 style={{fontSize:22,fontWeight:700,marginBottom:24,borderBottom:'2px solid #1a1a1a',paddingBottom:8}}>みんなの投稿</h2>
            <div style={{display:'flex',gap:8,marginBottom:20}}>
              <select value={filterGroup} onChange={e=>setFilterGroup(e.target.value)} style={{flex:1,border:'2px solid #ccc',padding:'8px 12px',borderRadius:4,fontSize:13}}>
                <option value="ALL">全グループ</option>
                {GROUPS.map(g=><option key={g} value={g}>{g}班</option>)}
              </select>
              <select value={filterTheme} onChange={e=>setFilterTheme(e.target.value)} style={{flex:1,border:'2px solid #ccc',padding:'8px 12px',borderRadius:4,fontSize:13}}>
                <option value="ALL">全テーマ</option>
                {THEMES.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {filtered.length===0 ? <p style={{textAlign:'center',color:'#999',marginTop:40}}>投稿がありません</p> : (
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12}}>
                {filtered.map(p=>(
                  <div key={p.id} onClick={()=>setSelected(p)} style={{background:'#fff',borderRadius:4,overflow:'hidden',cursor:'pointer',boxShadow:'0 1px 4px rgba(0,0,0,0.1)'}}>
                    <img src={p.photo_url} style={{width:'100%',aspectRatio:'1/1',objectFit:'cover'}} alt="" />
                    <div style={{padding:'10px 12px'}}>
                      <div style={{display:'flex',gap:6,marginBottom:6}}>
                        <span style={{background:'#1a1a1a',color:'#fff',fontSize:11,padding:'2px 7px',borderRadius:3,fontWeight:700}}>{p.group_name}班</span>
                        <span style={{background:THEME_COLOR[p.theme],color:'#fff',fontSize:11,padding:'2px 7px',borderRadius:3,fontWeight:700}}>{p.theme}</span>
                      </div>
                      {p.comment && <p style={{fontSize:12,color:'#444',lineHeight:1.5,marginBottom:4}}>{p.comment}</p>}
                      {p.audio_url && <span style={{fontSize:11,color:'#4a87b8'}}>🎙 音声あり</span>}
                      {myPostIds.includes(p.id) && <span style={{fontSize:11,color:'#999',marginLeft:6}}>自分の投稿</span>}
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
              <div style={{display:'flex',gap:6,marginBottom:12}}>
                <span style={{background:'#1a1a1a',color:'#fff',fontSize:11,padding:'2px 7px',borderRadius:3,fontWeight:700}}>{selected.group_name}班</span>
                <span style={{background:THEME_COLOR[selected.theme],color:'#fff',fontSize:11,padding:'2px 7px',borderRadius:3,fontWeight:700}}>{selected.theme}</span>
              </div>
              {selected.audio_url && <audio src={selected.audio_url} controls style={{width:'100%',marginBottom:12}} />}
              {selected.comment && <p style={{fontSize:14,lineHeight:1.7,color:'#333',marginBottom:12}}>{selected.comment}</p>}
              {myPostIds.includes(selected.id) && (
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
