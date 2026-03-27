'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

// --- 接続設定 ---
const supabaseUrl = 'https://zlpcaxrjwlbrisyurfdr.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpscGNheHJqd2xicmlzeXVyZmRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTkxNTcsImV4cCI6MjA5MDA5NTE1N30.BT4yx6ipKUvM-nieU0d0ofbiUqUE7hY4Q3x1EYI_Bs8'
const supabase = createClient(supabaseUrl, supabaseAnonKey)
const GROUPS = ['GroupA','GroupB','GroupC','GroupD','GroupE','GroupF','GroupG','GroupH']

export default function Home() {
  const [role, setRole] = useState<'student' | 'viewer' | 'teacher' | null>(null)
  const [userId, setUserId] = useState('')
  const [screen, setScreen] = useState<'home' | 'upload' | 'gallery'>('home')
  const [posts, setPosts] = useState<any[]>([])
  const [showHelp, setShowHelp] = useState(false)
  
  // 投稿管理
  const [uploadGroup, setUploadGroup] = useState('')
  const [comment, setComment] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  
  // 録音管理
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  // 🔄 HEIC変換ライブラリを確実にロード
  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/heic2any@0.0.3/dist/heic2any.min.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  // 🔄 ログイン保持
  useEffect(() => {
    const savedId = localStorage.getItem('photovox_id');
    const savedRole = localStorage.getItem('photovox_role') as any;
    if (savedId && savedRole) { setUserId(savedId); setRole(savedRole); }
  }, []);

  const handleLogin = () => {
    const rawId = userId.trim().replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    if (!rawId) return alert('学籍番号または班名を入力してください');
    let userRole: 'student' | 'viewer' | 'teacher' = (rawId === '0526') ? 'teacher' : (GROUPS.find(g => g.toLowerCase() === rawId.toLowerCase()) ? 'viewer' : 'student');
    let finalId = (userRole === 'viewer') ? GROUPS.find(g => g.toLowerCase() === rawId.toLowerCase())! : rawId;
    setRole(userRole); setUserId(finalId);
    localStorage.setItem('photovox_id', finalId); localStorage.setItem('photovox_role', userRole);
  };

  // ✨ 最重要：写真を「絶対に見られるURL」に直す処理
  const loadPosts = async () => {
    try {
      setStatusMsg('データを同期中...');
      const { data, error } = await supabase.from('posts').select('*');
      if (error) throw error;
      
      const repaired = (data || []).map(p => {
        const buildUrl = (path: string) => {
          if (!path) return "";
          const fileName = path.split('/').pop();
          return `${supabaseUrl}/storage/v1/object/public/photos/${fileName}`;
        };
        return { ...p, photo_url: buildUrl(p.photo_url), audio_url: buildUrl(p.audio_url) };
      });

      const sorted = repaired.sort((a, b) => (b.id || 0) - (a.id || 0));
      setPosts(role === 'viewer' ? sorted.filter(p => p.group_name?.toLowerCase() === userId.toLowerCase()) : sorted);
    } catch (e) { console.error(e); } finally { setStatusMsg(''); }
  };

  useEffect(() => { if (screen === 'gallery' && role) loadPosts(); }, [screen, role]);

  const handleUpload = async () => {
    if (!uploadGroup || !imageFile) return alert('班と写真を選んでください');
    setUploading(true);
    setStatusMsg('送信準備中...');

    try {
      let fileToUpload = imageFile;
      if (imageFile.name.toLowerCase().endsWith('.heic')) {
        setStatusMsg('iPhone形式をJPGに変換中...');
        const blob = await (window as any).heic2any({ blob: imageFile, toType: "image/jpeg", quality: 0.7 });
        fileToUpload = new File([Array.isArray(blob) ? blob[0] : blob], imageFile.name.replace(/\.heic/i, '.jpg'), { type: "image/jpeg" });
      }

      const ts = Date.now();
      const photoName = `photo_${ts}.jpg`;
      setStatusMsg('画像を送信中...');
      await supabase.storage.from('photos').upload(photoName, fileToUpload);

      let audioName = "";
      if (audioBlob) {
        setStatusMsg('音声を送信中...');
        audioName = `audio_${ts}.webm`;
        await supabase.storage.from('photos').upload(audioName, audioBlob);
      }

      setStatusMsg('DBに記録中...');
      await supabase.from('posts').insert([{
        user_id: userId, group_name: uploadGroup, theme: comment, photo_url: photoName, audio_url: audioName
      }]);

      alert('報告完了！');
      setComment(''); setImageFile(null); setAudioBlob(null); setScreen('gallery');
    } catch (e: any) { alert("送信エラー: " + e.message); } finally { setUploading(false); setStatusMsg(''); }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => setAudioBlob(new Blob(chunks, { type: 'audio/webm' }));
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (e) { alert("マイクを許可してください"); }
  };
  const stopRecording = () => { mediaRecorderRef.current?.stop(); setIsRecording(false); };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', minHeight: '100vh', background: '#f8f9fa', color: '#333', fontFamily: 'sans-serif' }}>
      <header style={{ background: '#1a1a1a', color: '#fff', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 50 }}>
        <h1 style={{ margin: 0, fontSize: '18px' }}>PhotoVox <span style={{fontSize:'10px', opacity:0.5}}>v7.0</span></h1>
        {role && <button onClick={() => setShowHelp(!showHelp)} style={{ background: '#f39c12', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}>HELP</button>}
      </header>

      {showHelp && (
        <div style={{ background: '#fff3cd', padding: '15px', borderBottom: '1px solid #ffeeba', fontSize: '13px', lineHeight: '1.6' }}>
          <strong>【調査の手順】</strong><br />
          1. 「投稿」から班を選び、写真を撮影してください。<br />
          2. 現場の状況を音声で録音できます（任意）。<br />
          3. メモを入力して送信ボタンを押してください。<br />
          ※画像が出ない時は、ギャラリーで「戻る」→再度「閲覧」してください。
        </div>
      )}

      <main style={{ padding: '20px' }}>
        {!role ? (
          <div style={{ background: '#fff', padding: '30px', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', marginTop: '40px', textAlign: 'center' }}>
            <h2 style={{ marginBottom: '25px' }}>調査演習ログイン</h2>
            <input type="text" placeholder="学籍番号 または 班名" value={userId} onChange={e => setUserId(e.target.value)} style={{ width: '100%', padding: '15px', fontSize: '18px', borderRadius: '12px', border: '2px solid #ddd', marginBottom: '20px', boxSizing: 'border-box' }} />
            <button onClick={handleLogin} style={{ width: '100%', padding: '15px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '18px', fontWeight: 'bold' }}>ログイン</button>
          </div>
        ) : screen === 'home' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '30px' }}>
            {role === 'student' && <button onClick={() => setScreen('upload')} style={{ padding: '60px 20px', fontSize: '24px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: '25px', fontWeight: 'bold', boxShadow: '0 8px 20px rgba(0,112,243,0.2)' }}>📸 調査報告を投稿</button>}
            <button onClick={() => setScreen('gallery')} style={{ padding: '60px 20px', fontSize: '24px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '25px', fontWeight: 'bold' }}>📂 ギャラリーを閲覧</button>
            <button onClick={() => {localStorage.clear(); location.reload();}} style={{ marginTop: '20px', color: '#999', background: 'none', border: 'none', textDecoration: 'underline' }}>ログアウト</button>
          </div>
        ) : screen === 'upload' ? (
          <div style={{ background: '#fff', padding: '20px', borderRadius: '25px', border: '1px solid #eee' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}><h3>新規報告</h3><button onClick={() => setScreen('home')}>戻る</button></div>
            <div style={{ marginBottom: '15px' }}><label style={{ fontWeight: 'bold' }}>担当班</label>
              <select value={uploadGroup} onChange={e => setUploadGroup(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', marginTop: '5px' }}>
                <option value="">-- 班を選択 --</option>{GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '15px' }}><label style={{ fontWeight: 'bold' }}>写真</label>
              <input type="file" accept="image/*,.heic" onChange={e => setImageFile(e.target.files?.[0] || null)} style={{ width: '100%', marginTop: '5px' }} />
            </div>
            <div style={{ marginBottom: '15px' }}><label style={{ fontWeight: 'bold' }}>音声 (任意)</label>
              <div style={{ background: '#f0f7ff', padding: '15px', borderRadius: '15px', textAlign: 'center', marginTop: '5px' }}>
                {!isRecording ? <button onClick={startRecording}>🎤 録音開始</button> : <button onClick={stopRecording} style={{ color: 'red' }}>🛑 停止</button>}
                {audioBlob && " ✅"}
              </div>
            </div>
            <div style={{ marginBottom: '20px' }}><label style={{ fontWeight: 'bold' }}>調査メモ</label>
              <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="状況を記入してください" style={{ width: '100%', height: '100px', padding: '10px', borderRadius: '10px', border: '1px solid #ddd', marginTop: '5px', boxSizing: 'border-box' }} />
            </div>
            <button onClick={handleUpload} disabled={uploading} style={{ width: '100%', padding: '20px', background: uploading ? '#ccc' : '#27ae60', color: '#fff', border: 'none', borderRadius: '15px', fontSize: '20px', fontWeight: 'bold' }}>
              {uploading ? statusMsg : '送信する'}
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>調査結果</h2>
              <button onClick={() => setScreen('home')} style={{ padding: '8px 15px', borderRadius: '10px', border: '1px solid #ddd', background: '#fff' }}>戻る</button>
            </div>
            {statusMsg && <div style={{textAlign:'center', padding:'10px', color:'#0070f3'}}>{statusMsg}</div>}
            {posts.length === 0 ? <p style={{textAlign:'center', color:'#999', marginTop: '50px'}}>まだデータがありません。</p> : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px' }}>
                {posts.map(p => (
                  <div key={p.id} style={{ background: '#fff', borderRadius: '25px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                    <div style={{ background: '#eee', minHeight: '200px' }}>
                      <img src={p.photo_url} style={{ width: '100%', display: 'block' }} loading="lazy" onError={(e) => { (e.target as any).src="https://via.placeholder.com/400?text=Reloading+Image..."; }} />
                    </div>
                    <div style={{ padding: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#0070f3', background: '#e7f3ff', padding: '4px 12px', borderRadius: '15px' }}>{p.group_name}</span>
                        {(role === 'teacher' || p.user_id === userId) && <button onClick={() => { if(confirm('削除しますか？')) supabase.from('posts').delete().eq('id', p.id).then(loadPosts) }} style={{ color: '#ff4d4f', border: 'none', background: 'none', fontSize: '12px' }}>削除</button>}
                      </div>
                      <p style={{ margin: '15px 0', fontSize: '16px', lineHeight: '1.6' }}>{p.theme}</p>
                      {p.audio_url && <audio src={p.audio_url} controls style={{ width: '100%', height: '35px' }} />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
      <footer style={{ textAlign: 'center', padding: '30px', color: '#bbb', fontSize: '12px' }}>
        Akita University Field Practice System v7.0
      </footer>
    </div>
  )
}