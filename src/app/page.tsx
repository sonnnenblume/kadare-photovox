'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

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

  useEffect(() => {
    const savedRole = sessionStorage.getItem('kadare_role') as any
    const savedGroup = sessionStorage.getItem('kadare_group') || ''
    if(savedRole) setRole(savedRole)
    if(savedGroup) setCurrentGroup(savedGroup)
  }, [])

  function handleLogout() {
    if(!confirm('ログアウトしますか？')) return
    sessionStorage.clear()
    setRole(null)
    setScreen('home')
    setCurrentGroup('')
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
      alert('IDが正しくありません')
    }
    setUserId('')
  }

  return (
    <div style={{minHeight:'100vh',background:'#f5f0e8',color:'#1a1a1a',fontFamily:'sans-serif'}}>
      <header style={{background:'#1a1a1a',padding:'12px',position:'sticky',top:0,zIndex:100}}>
        <div style={{maxWidth:600,margin:'0 auto',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div onClick={()=>setScreen('home')} style={{color:'#fff',fontSize:18,fontWeight:'bold',cursor:'pointer'}}>◎ PhotoVox</div>
          {role && (
            <nav style={{display:'flex',gap:10,alignItems:'center'}}>
              {role === 'teacher' && <span style={{color:'#ffd700',fontSize:12}}>教員モード</span>}
              {role === 'group' && <span style={{color:'#fff',fontSize:12}}>{currentGroup}</span>}
              <button onClick={handleLogout} style={{background:'#444',color:'#fff',border:'none',padding:'5px 12px',borderRadius:20,fontSize:12,cursor:'pointer'}}>ログアウト</button>
            </nav>
          )}
        </div>
      </header>

      <main style={{maxWidth:600,margin:'0 auto',padding:20}}>
        {!role ? (
          <div style={{paddingTop:100,textAlign:'center'}}>
            <h1 style={{fontSize:22,marginBottom:20}}>ログイン</h1>
            <input type="text" placeholder="学籍番号 / グループID / PW" value={userId} onChange={e=>setUserId(e.target.value)} 
              style={{padding:12,borderRadius:8,border:'1px solid #ccc',width:'100%',maxWidth:240,marginBottom:10,fontSize:16}} />
            <br/>
            <button onClick={handleLogin} style={{background:'#1a1a1a',color:'#fff',padding:'12px 40px',borderRadius:8,border:'none',fontWeight:'bold',cursor:'pointer'}}>ログイン</button>
          </div>
        ) : (
          <div style={{textAlign:'center',paddingTop:40}}>
            <h1 style={{fontSize:28,lineHeight:1.4}}>カダーレの発見を<br/>声にする</h1>
            
            <div style={{marginTop:40,display:'flex',flexDirection:'column',gap:15,maxWidth:300,margin:'40px auto'}}>
              {/* 学生と教員は投稿可能 */}
              {(role === 'student' || role === 'teacher') && (
                <button onClick={()=>setScreen('upload')} style={{background:'#1a1a1a',color:'#fff',padding:20,borderRadius:8,border:'none',fontSize:18,fontWeight:'bold',cursor:'pointer'}}>📷 投稿する</button>
              )}

              {/* グループと教員はギャラリー閲覧可能 */}
              {(role === 'group' || role === 'teacher') && (
                <button onClick={()=>setScreen('gallery')} style={{background:'#fff',color:'#1a1a1a',padding:20,borderRadius:8,border:'2px solid #1a1a1a',fontSize:16,cursor:'pointer'}}>
                  {role === 'group' ? '自グループの投稿を見る' : '全投稿を見る'}
                </button>
              )}

              {/* 学生がギャラリーを見ようとした時のメッセージ */}
              {role === 'student' && <p style={{fontSize:12,color:'#888'}}>※学生の方は投稿のみ可能です。閲覧はグループ用IDでログインしてください。</p>}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}