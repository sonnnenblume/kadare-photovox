'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const STUDENT_PASSWORD = '0519'
const TEACHER_PASSWORD = '0526'

export default function Home() {
  const [role, setRole] = useState<'student' | 'teacher' | null>(null)
  const [pwInput, setPwInput] = useState('')
  const [screen, setScreen] = useState<'home'|'upload'|'gallery'>('home')

  useEffect(() => {
    const savedRole = sessionStorage.getItem('kadare_role') as any
    if(savedRole) setRole(savedRole)
  }, [])

  function handleLogout() {
    if(!confirm('ログアウトしますか？')) return
    sessionStorage.clear()
    setRole(null)
    setScreen('home')
  }

  async function handleLogin() {
    if (pwInput.trim() === TEACHER_PASSWORD) {
      setRole('teacher'); sessionStorage.setItem('kadare_role', 'teacher')
    } else if (pwInput.trim() === STUDENT_PASSWORD) {
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
          <div style={{color:'#fff',fontSize:18,fontWeight:'bold'}}>◎ PhotoVox</div>
          {role && (
            <nav style={{display:'flex',gap:10}}>
              <button onClick={()=>setScreen('upload')} style={{background:'none',color:'#fff',border:'1px solid #444',padding:'5px 10px',borderRadius:20,fontSize:12}}>投稿</button>
              <button onClick={()=>setScreen('gallery')} style={{background:'none',color:'#fff',border:'1px solid #444',padding:'5px 10px',borderRadius:20,fontSize:12}}>ギャラリー</button>
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
          <div style={{textAlign:'center',paddingTop:40}}>
            <h1 style={{fontSize:32,lineHeight:1.4}}>カダーレで<br/>みつけたものを声にする</h1>
            <div style={{marginTop:40,display:'flex',flexDirection:'column',gap:15}}>
              <button onClick={()=>setScreen('upload')} style={{background:'#1a1a1a',color:'#fff',padding:20,borderRadius:8,border:'none',fontSize:18,fontWeight:'bold'}}>📷 写真を投稿する</button>
              <button onClick={()=>setScreen('gallery')} style={{background:'#fff',color:'#1a1a1a',padding:20,borderRadius:8,border:'2px solid #1a1a1a',fontSize:16}}>みんなの投稿を見る →</button>
              <button onClick={handleLogout} style={{marginTop:20,color:'#888',textDecoration:'underline',background:'none',border:'none',cursor:'pointer'}}>ログアウトして終了する</button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}