'use client'
import { useState, useRef, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

// Supabaseの接続設定（直接ここに書くか、環境変数から読み込む）
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const GROUPS = ['A','B','C','D','E','F','G','H']
const STUDENT_PASSWORD = '0519'
const TEACHER_PASSWORD = '0526'

type Post = {
  id: number
  created_at: string
  group_name: string
  comment: string
  photo_url: string
  audio_url: string | null
  student_name: string | null
}

export default function Home() {
  const [role, setRole] = useState<'student' | 'teacher' | 'group' | null>(null)
  const [pwInput, setPwInput] = useState('')
  const [screen, setScreen] = useState<'home'|'upload'|'gallery'>('home')
  const [posts, setPosts] = useState<Post[]>([])
  const [myPostIds, setMyPostIds] = useState<number[]>([])

  useEffect(() => {
    const savedRole = sessionStorage.getItem('kadare_role') as any
    if(savedRole) setRole(savedRole)
    const ids = JSON.parse(sessionStorage.getItem('kadare_my_posts') || '[]')
    setMyPostIds(ids)
  }, [])

  useEffect(() => { 
    if(screen==='gallery') loadPosts() 
  }, [screen])

  async function loadPosts() {
    const { data } = await supabase.from('posts').select('*').order('created_at',{ascending:false})
    if(data) setPosts(data)
  }

  // ログアウト処理
  function handleLogout() {
    if(!confirm('ログアウトしますか？')) return
    sessionStorage.clear()
    setRole(null)
    setPwInput('')
    setScreen('home')
  }

  async function handleLogin() {
    const input = pwInput.trim()
    if (input === TEACHER_PASSWORD) {
      setRole('teacher'); sessionStorage.setItem('kadare_role', 'teacher')
    } else if (input === STUDENT_PASSWORD) {
      setRole('student'); sessionStorage.setItem('kadare_role', 'student')
    } else {
      alert('パスワードが違います')
    }
    setPwInput('')
  }

  return (
    <div style={{minHeight:'100vh',background:'#f5f0e8',color:'#1a1a1a',fontFamily:'sans-serif'}}>
      <header style={{background:'#1a1a1a',padding:'12px',position:'sticky',top:0,zIndex:100}}>
        <div style={{maxWidth:600,margin:'0 auto',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <button onClick={()=>setScreen('home')} style={{background:'none',border:'none',color:'#fff',fontSize:18,fontWeight:'bold',cursor:'pointer'}}>◎ PhotoVox</button>
          {role && (
            <nav style={{display:'flex',gap:10}}>
              <button onClick={()=>setScreen('upload')} style={{background:'none',color:'#fff',border:'1px solid #444',padding:'5px 10px',borderRadius:20,fontSize:12}}>投稿</button>
              <button onClick={()=>setScreen('gallery')} style={{background:'none',color:'#fff',border:'1px solid #444',padding:'5px 10px',borderRadius:20,fontSize:12}}>一覧</button>
              <button onClick={handleLogout} style={{background:'#444',color:'#fff',border:'none',padding:'5px 10px',borderRadius:20,fontSize:12,cursor:'pointer'}}>ログアウト</button>
            </nav>
          )}
        </div>
      </header>

      <main style={{maxWidth:600,margin:'0 auto',padding:20}}>
        {!role ? (
          <div style={{paddingTop:100,textAlign:'center'}}>
            <h1 style={{fontSize:24,marginBottom:20}}>パスワードを入力</h1>
            <input type="password" value={pwInput} onChange={e=>setPwInput(e.target.value)} style={{padding:12,borderRadius:8,border:'1px solid #ccc',width:'100%',maxWidth:200,marginBottom:10}} />
            <br/>
            <button onClick={handleLogin} style={{background:'#1a1a1a',color:'#fff',padding:'12px 40px',borderRadius:8,border:'none',fontWeight:'bold'}}>入る</button>
          </div>
        ) : (
          <>
            {screen==='home' && (
              <div style={{textAlign:'center',paddingTop:40}}>
                <h1 style={{fontSize:32,lineHeight:1.4}}>カダーレで<br/>みつけたものを声にする</h1>
                <div style={{marginTop:40,display:'flex',flexDirection:'column',gap:15}}>
                  <button onClick={()=>setScreen('upload')} style={{background:'#1a1a1a',color:'#fff',padding:20,borderRadius:8,border:'none',fontSize:18,fontWeight:'bold'}}>📷 写真を投稿する</button>
                  <button onClick={()=>setScreen('gallery')} style={{background:'#fff',color:'#1a1a1a',padding:20,borderRadius:8,border:'2px solid #1a1a1a',fontSize:16}}>みんなの投稿を見る →</button>
                  <button onClick={handleLogout} style={{marginTop:20,color:'#888',textDecoration:'underline',background:'none',border:'none'}}>ログアウトして終了</button>
                </div>
              </div>
            )}
            {/* 投稿画面や一覧画面の詳細は前のコードと同様ですが、一旦シンプルに表示 */}
            {screen==='gallery' && (
               <div>
                 <h2 style={{borderBottom:'2px solid #000',paddingBottom:10}}>投稿一覧</h2>
                 <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:20}}>
                   {posts.map(p => (
                     <div key={p.id} style={{background:'#fff',borderRadius:8,overflow:'hidden'}}>
                       <img src={p.photo_url} style={{width:'100%',aspectRatio:'1/1',objectFit:'cover'}} />
                       <div style={{padding:8,fontSize:12}}>{p.comment}</div>
                     </div>
                   ))}
                 </div>
               </div>
            )}
            {/* upload画面（簡易版） */}
            {screen==='upload' && <div style={{textAlign:'center',paddingTop:40}}>投稿画面（開発中：ファイルを保存してGit Pushしてください）</div>}
          </>
        )}
      </main>
    </div>
  )
}