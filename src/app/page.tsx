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
        setStatusMsg('iPhone画像をJPGへ高精度変換中...');
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
    <div style={{ maxWidth: '600px', margin: '0 auto', minHeight: '100vh', background: '#f0f2f5', color: '#1c1e21', fontFamily: 'sans-serif' }}>
      <header style={{ background: '#ffffff', borderBottom: '1px solid #ddd', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', color: '#0070f3', fontWeight: 'bold' }}>PhotoVox <small style={{fontSize: '10px', verticalAlign: 'middle', opacity: 0.5}}>v11.0 PRO</small></h1>
          {role && <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>User: <strong>{userId}</strong> ({role})</div>}
        </div>
        {role && (
          <button onClick={() => setShowHelp(!showHelp)} style={{ background: showHelp ? '#ff4d4f' : '#f39c12', color: '#fff', border: 'none', padding: '6px 15px', borderRadius: '20px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            {showHelp ? '閉じる' : 'HELP'}
          </button>
        )}
      </header>

      {showHelp && (
        <div style={{ background: '#fff3cd', padding: '20px', borderBottom: '2px solid #f39c12', fontSize: '14px', lineHeight: '1.6', color: '#856404', animation: 'fadeIn 0.3s' }}>
          <h4 style={{ margin: '0 0 10px 0' }}>💡 フィールド調査ガイド</h4>
          <ol style={{ margin: 0, paddingLeft: '20px' }}>
            <li><strong>報告作成:</strong> 青いボタンから写真撮影・班選択。</li>
            <li><strong>音声録音:</strong> マイクボタンで現場の状況を記録。</li>
            <li><strong>送信:</strong> 送信後、ギャラリーで自分の投稿を確認。</li>
          </ol>
          <p style={{ marginTop: '10px', fontSize: '12px', borderTop: '1px dashed #f39c12', paddingTop: '10px' }}>
            ※画像が出ない時は、一度「戻る」でホームへ行き、再度「閲覧」してください。
          </p>
        </div>
      )}

      <main style={{ padding: '20px' }}>
        {!role ? (
          <div style={{ background: '#fff', padding: '40px 30px', borderRadius: '25px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', marginTop: '40px', textAlign: 'center' }}>
            <h2 style={{ marginBottom: '30px', fontSize: '24px', fontWeight: 'bold' }}>調査演習ログイン</h2>
            <input type="text" placeholder="学籍番号 または 班名" value={userId} onChange={e => setUserId(e.target.value)} style={{ width: '100%', padding: '18px', fontSize: '18px', borderRadius: '15px', border: '2px solid #eee', marginBottom: '20px', boxSizing: 'border-box', outline: 'none' }} />
            <button onClick={handleLogin} style={{ width: '100%', padding: '18px', background: '#1c1e21', color: '#fff', border: 'none', borderRadius: '15px', fontSize: '20px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>開始する</button>
          </div>
        ) : screen === 'home' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', marginTop: '30px' }}>
            {role === 'student' && (
              <button onClick={() => setScreen('upload')} style={{ padding: '70px 20px', fontSize: '24px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: '25px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,112,243,0.3)', transition: 'transform 0.1s' }}>
                📸 調査報告を投稿
              </button>
            )}
            <button onClick={() => setScreen('gallery')} style={{ padding: '70px 20px', fontSize: '24px', background: '#ffffff', color: '#1c1e21', border: '2px solid #1c1e21', borderRadius: '25px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              📂 データを閲覧
            </button>
            <button onClick={() => {localStorage.clear(); location.reload();}} style={{ color: '#999', background: 'none', border: 'none', textDecoration: 'underline', marginTop: '30px', fontSize: '14px' }}>別のIDでログイン</button>
          </div>
        ) : screen === 'upload' ? (
          <div style={{ background: '#fff', padding: '25px', borderRadius: '25px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '25px', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '20px' }}>🛠 新規報告の作成</h3>
              <button onClick={() => setScreen('home')} style={{ padding: '8px 15px', borderRadius: '10px', border: '1px solid #ddd', background: '#fff' }}>戻る</button>
            </div>
            <div style={{ marginBottom: '20px' }}><label style={{fontWeight:'bold', fontSize: '14px'}}>1. 担当班の選択</label>
              <select value={uploadGroup} onChange={e => setUploadGroup(e.target.value)} style={{ width: '100%', padding: '15px', marginTop: '8px', borderRadius: '12px', border: '1px solid #ccc', fontSize: '16px' }}>
                <option value="">-- 班を選択 --</option>{GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '20px' }}><label style={{fontWeight:'bold', fontSize: '14px'}}>2. 調査写真（カメラ起動）</label>
              <input type="file" accept="image/*,.heic" onChange={e => setImageFile(e.target.files?.[0] || null)} style={{ width: '100%', marginTop: '8px', fontSize: '14px' }} />
            </div>
            <div style={{ marginBottom: '20px' }}><label style={{fontWeight:'bold', fontSize: '14px'}}>3. 音声アノテーション (任意)</label>
              <div style={{ background: '#f8fbff', padding: '20px', borderRadius: '15px', textAlign: 'center', marginTop: '8px', border: '1px dashed #0070f3' }}>
                {!isRecording ? <button onClick={() => {
                  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
                    const rec = new MediaRecorder(stream); const ch: any[] = [];
                    rec.ondataavailable = e => ch.push(e.data);
                    rec.onstop = () => setAudioBlob(new Blob(ch, { type: 'audio/webm' }));
                    rec.start(); mediaRecorderRef.current = rec; setIsRecording(true);
                  });
                }} style={{ background: '#0070f3', color: '#fff', border: 'none', padding: '10px 25px', borderRadius: '25px', fontWeight: 'bold' }}>🎤 録音を開始</button> 
                : <button onClick={() => { mediaRecorderRef.current?.stop(); setIsRecording(false); }} style={{ background: '#ff4d4f', color: '#fff', border: 'none', padding: '10px 25px', borderRadius: '25px', fontWeight: 'bold' }}>🛑 停止して保存</button>}
                {audioBlob && <div style={{marginTop:'10px', color:'#27ae60', fontSize:'12px'}}>✅ 音声データ準備完了</div>}
              </div>
            </div>
            <div style={{ marginBottom: '25px' }}><label style={{fontWeight:'bold', fontSize: '14px'}}>4. 調査メモ</label>
              <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="発見した内容、数値、特記事項など" style={{ width: '100%', height: '120px', marginTop: '8px', boxSizing: 'border-box', padding: '15px', borderRadius: '12px', border: '1px solid #ccc', fontSize: '16px' }} />
            </div>
            <button onClick={handleUpload} disabled={uploading} style={{ width: '100%', padding: '20px', background: uploading ? '#ccc' : '#27ae60', color: '#fff', border: 'none', borderRadius: '15px', fontSize: '20px', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(39,174,96,0.3)' }}>
              {uploading ? statusMsg : '🚀 報告を送信する'}
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '25px', alignItems:'center' }}>
              <h2 style={{margin:0, fontSize: '22px'}}>📊 調査結果一覧</h2>
              <button onClick={() => setScreen('home')} style={{padding:'10px 20px', borderRadius: '12px', border: '1px solid #1c1e21', background: '#fff', fontWeight: 'bold'}}>戻る</button>
            </div>
            {statusMsg && <div style={{textAlign:'center', color:'#0070f3', padding:'15px', fontWeight: 'bold'}}>{statusMsg}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '25px' }}>
              {posts.length === 0 ? <p style={{textAlign:'center', color:'#999', marginTop:'50px'}}>データがまだありません。</p> : posts.map(p => (
                <div key={p.id} style={{ background: '#fff', borderRadius: '25px', overflow: 'hidden', boxShadow: '0 5px 15px rgba(0,0,0,0.08)' }}>
                  <img src={p.photo_url} style={{ width: '100%', display: 'block', background: '#eee', minHeight: '250px', objectFit: 'cover' }} loading="lazy" />
                  <div style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 'bold', color: '#0070f3', background: '#eef6ff', padding: '5px 15px', borderRadius: '10px', fontSize: '14px' }}>{p.group_name}</span>
                      {(role === 'teacher' || p.user_id === userId) && <button onClick={() => { if(confirm('このデータを消去しますか？')) supabase.from('posts').delete().eq('id', p.id).then(fetchPosts) }} style={{ color: '#ff4d4f', border: 'none', background: 'none', fontSize: '12px', cursor: 'pointer' }}>削除</button>}
                    </div>
                    <p style={{ margin: '15px 0', fontSize: '16px', lineHeight: '1.6', color: '#333' }}>{p.theme}</p>
                    {p.audio_url && <audio src={p.audio_url} controls style={{ width: '100%', height: '40px', marginTop: '10px' }} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      <footer style={{ textAlign: 'center', padding: '40px 20px', color: '#bbb', fontSize: '12px' }}>
        Akita University Field Practice Management System<br/>
        Professional Edition v11.0 | Stable Build
      </footer>
    </div>
  )
}