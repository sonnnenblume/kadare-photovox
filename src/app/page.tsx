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
  const [showHelp, setShowHelp] = useState(false) // 👈 ヘルプ状態の維持
  const [uploadGroup, setUploadGroup] = useState('')
  const [comment, setComment] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
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
    setStatusMsg('最新の調査データを同期中...');
    try {
      const { data, error } = await supabase.from('posts').select('*');
      if (error) throw error;
      const processed = (data || []).map(p => ({
        ...p, photo_url: resolvePublicUrl(p.photo_url), audio_url: resolvePublicUrl(p.audio_url)
      })).sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
      setPosts(role === 'viewer' ? processed.filter(p => p.group_name?.toLowerCase() === userId.toLowerCase()) : processed);
    } catch (err) { console.error(err); } finally { setStatusMsg(''); }
  };

  useEffect(() => { if (screen === 'gallery') fetchPosts(); }, [screen, role]);

  const handleUpload = async () => {
    if (!uploadGroup || !imageFile) return alert('【入力不足】班の選択と写真は必須です。');
    setUploading(true);
    setStatusMsg('アップロード準備中...');
    try {
      let activeFile = imageFile;
      if (imageFile.name.toLowerCase().endsWith('.heic')) {
        setStatusMsg('iPhone画像を変換中...');
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
      alert('報告が完了しました！');
      setComment(''); setImageFile(null); setAudioBlob(null); setScreen('gallery');
    } catch (e: any) { alert("送信エラー: " + e.message); } finally { setUploading(false); setStatusMsg(''); }
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
    <div style={{ maxWidth: '600px', margin: '0 auto', minHeight: '100vh', background: '#f8f9fa', fontFamily: 'sans-serif' }}>
      {/* 🚀 厚みのあるプロフェッショナル・ヘッダー */}
      <header style={{ background: '#1a1a1a', color: '#fff', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '18px' }}>PhotoVox <small style={{opacity:0.5}}>v10.0</small></h1>
          {role && <div style={{ fontSize: '10px', color: '#00d1b2' }}>ID: {userId} ({role})</div>}
        </div>
        {role && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setShowHelp(!showHelp)} style={{ background: showHelp ? '#e74c3c' : '#f39c12', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px' }}>
              {showHelp ? '閉じる' : 'HELP'}
            </button>
          </div>
        )}
      </header>

      {/* 📖 ヘルプパネル：現場の学生を救う「厚み」 */}
      {showHelp && (
        <div style={{ background: '#fff3cd', padding: '20px', borderBottom: '2px solid #f39c12', fontSize: '14px', lineHeight: '1.6', color: '#856404' }}>
          <h4 style={{ margin: '0 0 10px 0' }}>💡 フィールド調査ガイド</h4>
          <ol style={{ margin: 0, paddingLeft: '20px' }}>
            <li><strong>報告作成:</strong> 青いボタンから写真と班を選びます。</li>
            <li><strong>音声録音:</strong> 現場の音や説明を30秒以内で録音できます。</li>
            <li><strong>送信:</strong> 「送信する」を押し、完了の合図が出るまで待機してください。</li>
            <li><strong>閲覧:</strong> 黒いボタンから、自分たちの班（または全班）のデータが見られます。</li>
          </ol>
          <p style={{ marginTop: '10px', fontSize: '12px', borderTop: '1px dashed #f39c12', pt: '10px' }}>
            ※画像が表示されない場合は、一度ホームに戻ってから再度ギャラリーを開いてください。
          </p>
        </div>
      )}

      <main style={{ padding: '20px' }}>
        {!role ? (
          <div style={{ background: '#fff', padding: '30px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', marginTop: '40px' }}>
            <h2 style={{ textAlign: 'center', marginBottom: '25px' }}>演習システム ログイン</h2>
            <input type="text" placeholder="学籍番号 または 班名" value={userId} onChange={e => setUserId(e.target.value)} style={{ width: '100%', padding: '15px', fontSize: '18px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '15px', boxSizing: 'border-box' }} />
            <button onClick={handleLogin} style={{ width: '100%', padding: '15px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '18px', fontWeight: 'bold' }}>ログイン</button>
          </div>
        ) : screen === 'home' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
            {role === 'student' && <button onClick={() => setScreen('upload')} style={{ padding: '60px 20px', fontSize: '22px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: '15px', fontWeight: 'bold' }}>📸 調査報告を投稿</button>}
            <button onClick={() => setScreen('gallery')} style={{ padding: '60px 20px', fontSize: '22px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '15px', fontWeight: 'bold' }}>📂 データを閲覧</button>
            <button onClick={() => {localStorage.clear(); location.reload();}} style={{ color: '#999', background: 'none', border: 'none', textDecoration: 'underline', marginTop: '20px' }}>別のIDでログインし直す</button>
          </div>
        ) : screen === 'upload' ? (
          <div style={{ background: '#fff', padding: '20px', borderRadius: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}><h3>新規報告</h3><button onClick={() => setScreen('home')}>戻る</button></div>
            <div style={{ marginBottom: '15px' }}><label style={{fontWeight:'bold'}}>1. 担当班</label>
              <select value={uploadGroup} onChange={e => setUploadGroup(e.target.value)} style={{ width: '100%', padding: '12px', marginTop: '5px' }}>
                <option value="">-- 班を選択 --</option>{GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '15px' }}><label style={{fontWeight:'bold'}}>2. 調査写真</label>
              <input type="file" accept="image/*,.heic" onChange={e => setImageFile(e.target.files?.[0] || null)} style={{ width: '100%', marginTop: '5px' }} />
            </div>
            <div style={{ marginBottom: '15px' }}><label style={{fontWeight:'bold'}}>3. 音声解説 (任意)</label>
              <div style={{ background: '#f0f7ff', padding: '15px', borderRadius: '10px', textAlign: 'center', marginTop: '5px' }}>
                {!isRecording ? <button onClick={() => {
                  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
                    const rec = new MediaRecorder(stream); const ch: any[] = [];
                    rec.ondataavailable = e => ch.push(e.data);
                    rec.onstop = () => setAudioBlob(new Blob(ch, { type: 'audio/webm' }));
                    rec.start(); mediaRecorderRef.current = rec; setIsRecording(true);
                  });
                }}>🎤 録音開始</button> : <button onClick={() => { mediaRecorderRef.current?.stop(); setIsRecording(false); }} style={{color:'red'}}>🛑 停止</button>}
                {audioBlob && " ✅ 録音済み"}
              </div>
            </div>
            <div style={{ marginBottom: '20px' }}><label style={{fontWeight:'bold'}}>4. 調査メモ</label>
              <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="気づいたことを記入" style={{ width: '100%', height: '100px', marginTop: '5px', boxSizing: 'border-box', padding: '10px' }} />
            </div>
            <button onClick={handleUpload} disabled={uploading} style={{ width: '100%', padding: '18px', background: uploading ? '#ccc' : '#27ae60', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '20px', fontWeight: 'bold' }}>
              {uploading ? statusMsg : '送信する'}
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems:'center' }}>
              <h2 style={{margin:0}}>調査結果一覧</h2>
              <button onClick={() => setScreen('home')} style={{padding:'8px 15px'}}>戻る</button>
            </div>
            {statusMsg && <div style={{textAlign:'center', color:'#0070f3', padding:'10px'}}>{statusMsg}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
              {posts.map(p => (
                <div key={p.id} style={{ background: '#fff', borderRadius: '15px', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                  <img src={p.photo_url} style={{ width: '100%', display: 'block', background: '#eee', minHeight: '200px' }} loading="lazy" />
                  <div style={{ padding: '15px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 'bold', color: '#0070f3' }}>{p.group_name}</span>
                      {(role === 'teacher' || p.user_id === userId) && <button onClick={() => { if(confirm('消去しますか？')) supabase.from('posts').delete().eq('id', p.id).then(fetchPosts) }} style={{ color: 'red', border: 'none', background: 'none' }}>削除</button>}
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
      <footer style={{ textAlign: 'center', padding: '30px', color: '#bbb', fontSize: '12px' }}>
        Akita University Field Practice Support System v10.0
      </footer>
    </div>
  )
}