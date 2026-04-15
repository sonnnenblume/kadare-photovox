'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://zlpcaxrjwlbrisyurfdr.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpscGNheHJqd2xicmlzeXVyZmRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTkxNTcsImV4cCI6MjA5MDA5NTE1N30.BT4yx6ipKUvM-nieU0d0ofbiUqUE7hY4Q3x1EYI_Bs8'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const GROUPS = ['GroupA','GroupB','GroupC','GroupD','GroupE','GroupF','GroupG','GroupH']

export default function Home() {
  const [role, setRole] = useState<'student' | 'viewer' | 'teacher' | null>(null)
  const [userId, setUserId] = useState('')
  const [screen, setScreen] = useState<'home' | 'upload' | 'gallery'>('home')
  const [posts, setPosts] = useState<any[]>([])
  const [showHelp, setShowHelp] = useState(false)
  
  // 入力保持State（画面切り替えで消えない）
  const [uploadGroup, setUploadGroup] = useState('')
  const [comment, setComment] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  
  const [uploading, setUploading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/heic2any@0.0.3/dist/heic2any.min.js";
    script.async = true; document.body.appendChild(script);
    const savedId = localStorage.getItem('photovox_id');
    const savedRole = localStorage.getItem('photovox_role') as any;
    if (savedId && savedRole) { setUserId(savedId); setRole(savedRole); }
  }, []);

  const resolvePublicUrl = useCallback((path: string) => {
    if (!path) return "";
    if (path.startsWith('http')) return path;
    const fileName = path.split('/').pop();
    const { data } = supabase.storage.from('photos').getPublicUrl(fileName || "");
    return data.publicUrl;
  }, []);

  const fetchPosts = async () => {
    setStatusMsg('同期中...');
    try {
      const { data, error } = await supabase.from('posts').select('*');
      if (error) throw error;
      const processed = (data || []).map(p => ({
        ...p, photo_url: resolvePublicUrl(p.photo_url), audio_url: resolvePublicUrl(p.audio_url)
      })).sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
      setPosts(role === 'viewer' ? processed.filter(p => p.group_name?.toLowerCase() === userId.toLowerCase()) : processed);
    } catch (err) { console.error(err); } finally { setStatusMsg(''); }
  };

  useEffect(() => { if (screen === 'gallery') fetchPosts(); }, [screen, role, userId]);

  const handleLogout = () => {
    if (confirm('ログアウトして初期画面に戻りますか？')) { localStorage.clear(); window.location.reload(); }
  };

  const handleUpload = async () => {
    if (!uploadGroup || !imageFile) return alert('班の選択と写真は必須です。');
    setUploading(true);
    setStatusMsg('送信中...');
    try {
      let activeFile = imageFile;
      if (imageFile.name.toLowerCase().endsWith('.heic')) {
        setStatusMsg('iPhone画像変換中...');
        const blob = await (window as any).heic2any({ blob: imageFile, toType: "image/jpeg", quality: 0.8 });
        activeFile = new File([Array.isArray(blob) ? blob[0] : blob], imageFile.name.replace(/\.heic/i, '.jpg'), { type: "image/jpeg" });
      }
      const ts = Date.now();
      const photoName = `res_${ts}.jpg`;
      await supabase.storage.from('photos').upload(photoName, activeFile);
      let audioName = "";
      if (audioBlob) {
        audioName = `aud_${ts}.webm`;
        await supabase.storage.from('photos').upload(audioName, audioBlob);
      }
      await supabase.from('posts').insert([{ user_id: userId, group_name: uploadGroup, theme: comment, photo_url: photoName, audio_url: audioName }]);
      alert('報告完了しました！');
      // 送信成功時のみリセット
      setComment(''); setImageFile(null); setAudioBlob(null); setScreen('gallery');
    } catch (e: any) { alert("エラー: " + e.message); } finally { setUploading(false); setStatusMsg(''); }
  };

  const handleLogin = () => {
    const cleanId = userId.trim().replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    if (!cleanId) return;
    let targetRole: any = (cleanId === '0526') ? 'teacher' : (GROUPS.find(g => g.toLowerCase() === cleanId.toLowerCase()) ? 'viewer' : 'student');
    let finalId = (targetRole === 'viewer') ? GROUPS.find(g => g.toLowerCase() === cleanId.toLowerCase())! : cleanId;
    setRole(targetRole); setUserId(finalId);
    localStorage.setItem('photovox_id', finalId); localStorage.setItem('photovox_role', targetRole);
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', minHeight: '100vh', background: '#f0f2f5', fontFamily: 'sans-serif', paddingBottom: '40px' }}>
      <header style={{ background: '#fff', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div onClick={() => setScreen('home')} style={{ cursor: 'pointer' }}>
          <h1 style={{ margin: 0, fontSize: '18px', color: '#0070f3', fontWeight:'bold' }}>PhotoVox v13.0 PRO</h1>
          {role && <div style={{ fontSize: '10px', color: '#666' }}>ID: {userId} ({role})</div>}
        </div>
        {role && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setShowHelp(!showHelp)} style={{ background: '#f39c12', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '15px', fontSize: '12px' }}>HELP</button>
            <button onClick={handleLogout} style={{ background: 'none', color: '#ff4d4f', border: '1px solid #ff4d4f', padding: '5px 10px', borderRadius: '15px', fontSize: '11px' }}>終了</button>
          </div>
        )}
      </header>

      <main style={{ padding: '20px' }}>
        {!role ? (
          <div style={{ background: '#fff', padding: '40px 30px', borderRadius: '25px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', marginTop: '40px', textAlign: 'center' }}>
            <h2 style={{ marginBottom: '25px' }}>調査演習 ログイン</h2>
            <input type="text" placeholder="学籍番号 または 班名" value={userId} onChange={e => setUserId(e.target.value)} style={{ width: '100%', padding: '18px', fontSize: '18px', borderRadius: '15px', border: '2px solid #eee', marginBottom: '20px', boxSizing: 'border-box' }} />
            <button onClick={handleLogin} style={{ width: '100%', padding: '18px', background: '#1c1e21', color: '#fff', border: 'none', borderRadius: '15px', fontSize: '20px', fontWeight: 'bold' }}>開始する</button>
          </div>
        ) : screen === 'home' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
            {role === 'student' && (
              <button onClick={() => setScreen('upload')} style={{ padding: '70px 20px', fontSize: '22px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: '25px', fontWeight: 'bold', boxShadow: '0 8px 20px rgba(0,112,243,0.3)' }}>📸 調査報告を投稿</button>
            )}
            <button onClick={() => setScreen('gallery')} style={{ padding: '70px 20px', fontSize: '22px', background: '#fff', color: '#1c1e21', border: '2px solid #1c1e21', borderRadius: '25px', fontWeight: 'bold' }}>📂 データを閲覧</button>
            <button onClick={handleLogout} style={{ marginTop: '20px', background: 'none', border: 'none', color: '#999', textDecoration: 'underline' }}>ログアウト（別のユーザーでログイン）</button>
          </div>
        ) : screen === 'upload' ? (
          <div style={{ background: '#fff', padding: '25px', borderRadius: '25px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>報告作成</h3>
              <button onClick={() => setScreen('home')} style={{ background: '#eee', border: 'none', padding: '5px 15px', borderRadius: '10px' }}>戻る</button>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{fontWeight:'bold', display:'block', marginBottom:'8px'}}>1. 担当班の選択</label>
              <select value={uploadGroup} onChange={e => setUploadGroup(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '2px solid #ddd' }}>
                <option value="">-- 班を選択 --</option>{GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{fontWeight:'bold', display:'block', marginBottom:'8px'}}>2. 調査写真</label>
              <div style={{ position: 'relative', width: '100%', height: '100px', border: '2px dashed #0070f3', borderRadius: '15px', background: imageFile ? '#eef6ff' : '#f8fbff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{fontSize:'20px'}}>{imageFile ? '✅' : '📷'}</div>
                  <div style={{ fontSize: '12px', color: '#0070f3', fontWeight:'bold' }}>{imageFile ? imageFile.name : 'タップして写真を撮影'}</div>
                </div>
                <input type="file" accept="image/*,.heic" onChange={e => setImageFile(e.target.files?.[0] || null)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0 }} />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{fontWeight:'bold', display:'block', marginBottom:'8px'}}>3. 音声解説 (任意)</label>
              <div style={{ background: '#f8fbff', padding: '15px', borderRadius: '15px', textAlign: 'center', border: '2px dashed #ddd' }}>
                {!isRecording ? <button onClick={() => {
                  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
                    const rec = new MediaRecorder(stream); const ch: any[] = [];
                    rec.ondataavailable = e => ch.push(e.data);
                    rec.onstop = () => setAudioBlob(new Blob(ch, { type: 'audio/webm' }));
                    rec.start(); mediaRecorderRef.current = rec; setIsRecording(true);
                  });
                }} style={{ background: '#0070f3', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '25px' }}>🎤 録音開始</button> 
                : <button onClick={() => { mediaRecorderRef.current?.stop(); setIsRecording(false); }} style={{ background: '#ff4d4f', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '25px' }}>🛑 停止</button>}
                {audioBlob && <div style={{marginTop:'5px', color:'#27ae60', fontSize:'11px', fontWeight:'bold'}}>✅ 音声データ準備完了</div>}
              </div>
            </div>

            <div style={{ marginBottom: '25px' }}>
              <label style={{fontWeight:'bold', display:'block', marginBottom:'8px'}}>4. 調査メモ</label>
              <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="数値、部材名、現場の気づきを記入" style={{ width: '100%', height: '100px', boxSizing: 'border-box', padding: '15px', borderRadius: '12px', border: '2px solid #ddd' }} />
            </div>

            <button onClick={handleUpload} disabled={uploading} style={{ width: '100%', padding: '20px', background: uploading ? '#ccc' : '#27ae60', color: '#fff', border: 'none', borderRadius: '15px', fontSize: '20px', fontWeight: 'bold' }}>
              {uploading ? statusMsg : '🚀 報告を送信'}
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems:'center' }}>
              <h2 style={{margin:0, fontSize: '20px'}}>調査結果一覧</h2>
              <button onClick={() => setScreen('home')} style={{padding:'8px 15px', borderRadius: '10px', background: '#fff', border: '1px solid #ddd'}}>戻る</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
              {posts.map(p => (
                <div key={p.id} style={{ background: '#fff', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                  <img src={p.photo_url} style={{ width: '100%', display: 'block', background: '#eee', minHeight: '200px', objectFit: 'cover' }} />
                  <div style={{ padding: '15px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 'bold', color: '#0070f3', background: '#eef6ff', padding: '4px 10px', borderRadius: '8px', fontSize: '12px' }}>{p.group_name}</span>
                    </div>
                    <p style={{ margin: '10px 0', fontSize: '15px' }}>{p.theme}</p>
                    {p.audio_url && <audio src={p.audio_url} controls style={{ width: '100%', height: '35px' }} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      <footer style={{textAlign:'center', padding:'20px', color:'#ccc', fontSize:'10px'}}>
        PhotoVox v13.0 PRO | FIELD RESEARCH SUPPORT SYSTEM
      </footer>
    </div>
  )
}