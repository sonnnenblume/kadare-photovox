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
  
  // 投稿用
  const [uploadGroup, setUploadGroup] = useState('')
  const [comment, setComment] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  
  // 録音用
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  // 🔄 外部ライブラリ（HEIC変換）の動的ロード
  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/heic2any@0.0.3/dist/heic2any.min.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  // 🔄 セッション保持
  useEffect(() => {
    const savedId = localStorage.getItem('photovox_id');
    const savedRole = localStorage.getItem('photovox_role') as any;
    if (savedId && savedRole) {
      setUserId(savedId);
      setRole(savedRole);
    }
  }, []);

  const handleLogin = () => {
    const rawId = userId.trim().replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    if (!rawId) return alert('学籍番号または班名を入力してください');

    let userRole: 'student' | 'viewer' | 'teacher' = 'student';
    let finalId = rawId;

    if (rawId === '0526') {
      userRole = 'teacher';
    } else {
      const matched = GROUPS.find(g => g.toLowerCase() === rawId.toLowerCase());
      if (matched) {
        userRole = 'viewer';
        finalId = matched;
      }
    }
    setRole(userRole);
    setUserId(finalId);
    localStorage.setItem('photovox_id', finalId);
    localStorage.setItem('photovox_role', userRole);
  };

  const loadPosts = async () => {
    try {
      const { data, error } = await supabase.from('posts').select('*');
      if (error) throw error;
      
      // ✨ 強制URL再生成ロジック：DBのURLが不完全でも、表示時に最新のPublicリンクを作る
      const repaired = (data || []).map(p => {
        const getUrl = (path: string) => {
          if(!path) return "";
          const fileName = path.split('/').pop();
          const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(fileName!);
          return publicUrl;
        }
        return { ...p, photo_url: getUrl(p.photo_url), audio_url: getUrl(p.audio_url) };
      });

      const sorted = repaired.sort((a, b) => (b.id || 0) - (a.id || 0));
      setPosts(role === 'viewer' ? sorted.filter(p => p.group_name?.toLowerCase() === userId.toLowerCase()) : sorted);
    } catch (e) { console.error("データ取得エラー:", e); }
  };

  useEffect(() => {
    if (screen === 'gallery' && role) loadPosts();
  }, [screen, role]);

  const handleDelete = async (postId: number) => {
    if (!confirm('この投稿を削除しますか？（元に戻せません）')) return;
    try {
      const { error } = await supabase.from('posts').delete().eq('id', postId);
      if (error) throw error;
      loadPosts();
    } catch (e) { alert('削除できませんでした。'); }
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
    } catch (e) { alert("マイクの使用を許可してください"); }
  };
  const stopRecording = () => { mediaRecorderRef.current?.stop(); setIsRecording(false); };

  const handleUpload = async () => {
    if (!uploadGroup || !imageFile) return alert('班と写真を選択してください');
    setUploading(true);
    setStatusMsg('準備中...');

    try {
      let fileToUpload = imageFile;
      
      // ✨ HEIC自動変換
      if (imageFile.name.toLowerCase().endsWith('.heic')) {
        setStatusMsg('iPhone形式を変換中...');
        const blob = await (window as any).heic2any({ blob: imageFile, toType: "image/jpeg", quality: 0.7 });
        fileToUpload = new File([Array.isArray(blob) ? blob[0] : blob], imageFile.name.replace(/\.heic/i, '.jpg'), { type: "image/jpeg" });
      }

      setStatusMsg('写真をアップロード中...');
      const ts = Date.now();
      const fileName = `photo_${ts}.jpg`;
      const { error: upErr } = await supabase.storage.from('photos').upload(fileName, fileToUpload);
      if (upErr) throw upErr;

      let audioName = "";
      if (audioBlob) {
        setStatusMsg('音声をアップロード中...');
        audioName = `audio_${ts}.webm`;
        await supabase.storage.from('photos').upload(audioName, audioBlob);
      }

      setStatusMsg('データベースに保存中...');
      await supabase.from('posts').insert([{
        user_id: userId, group_name: uploadGroup, theme: comment,
        photo_url: fileName, audio_url: audioName
      }]);

      alert('投稿が完了しました！');
      setComment(''); setImageFile(null); setAudioBlob(null); setScreen('gallery');
    } catch (e: any) {
      alert("送信エラー: " + e.message);
    } finally {
      setUploading(false);
      setStatusMsg('');
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', minHeight: '100vh', background: '#f0f2f5', color: '#1c1e21', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* ヘッダー */}
      <header style={{ background: '#ffffff', borderBottom: '1px solid #ddd', padding: '15px 20px', position: 'sticky', top: 0, zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '20px', color: '#0070f3' }}>PhotoVox</h1>
        {role && <span style={{ fontSize: '12px', background: '#eee', padding: '4px 10px', borderRadius: '20px' }}>{userId}</span>}
      </header>

      <main style={{ padding: '15px' }}>
        {!role ? (
          <div style={{ background: '#fff', padding: '30px', borderRadius: '15px', marginTop: '40px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <h2 style={{ textAlign: 'center', marginBottom: '25px' }}>調査演習ログイン</h2>
            <input type="text" placeholder="学籍番号 または 班名" value={userId} onChange={e => setUserId(e.target.value)} style={{ width: '100%', padding: '15px', fontSize: '18px', border: '1px solid #ddd', borderRadius: '10px', marginBottom: '15px', boxSizing: 'border-box' }} />
            <button onClick={handleLogin} style={{ width: '100%', padding: '15px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>ログイン</button>
          </div>
        ) : screen === 'home' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
            {role === 'student' && (
              <button onClick={() => setScreen('upload')} style={{ padding: '50px 20px', fontSize: '22px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: '20px', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(0,112,243,0.3)' }}>📸 調査報告を投稿</button>
            )}
            <button onClick={() => setScreen('gallery')} style={{ padding: '50px 20px', fontSize: '22px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '20px', fontWeight: 'bold' }}>📂 ギャラリーを閲覧</button>
            <button onClick={() => {localStorage.clear(); location.reload();}} style={{ marginTop: '20px', color: '#777', background: 'none', border: 'none', textDecoration: 'underline' }}>ログアウト</button>
          </div>
        ) : screen === 'upload' ? (
          <div style={{ background: '#fff', padding: '20px', borderRadius: '15px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>報告作成</h3>
              <button onClick={() => setScreen('home')} style={{ background: '#f0f0f0', border: 'none', padding: '5px 15px', borderRadius: '8px' }}>戻る</button>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>担当班</label>
              <select value={uploadGroup} onChange={e => setUploadGroup(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }}>
                <option value="">選択してください</option>
                {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>写真（JPEG/HEIC）</label>
              <input type="file" accept="image/*,.heic" onChange={e => setImageFile(e.target.files?.[0] || null)} style={{ width: '100%' }} />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>音声コメント</label>
              <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '10px', textAlign: 'center', border: '1px dashed #ccc' }}>
                {!isRecording ? <button onClick={startRecording} style={{ background: '#0070f3', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '20px' }}>🎤 録音開始</button> : <button onClick={stopRecording} style={{ background: '#ff4d4f', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '20px' }}>🛑 停止</button>}
                {audioBlob && <div style={{ marginTop: '5px', color: '#52c41a', fontSize: '12px' }}>✅ 録音済み</div>}
              </div>
            </div>

            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>調査メモ</label>
              <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="気づいた点など" style={{ width: '100%', height: '100px', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
            </div>

            <button onClick={handleUpload} disabled={uploading} style={{ width: '100%', padding: '18px', background: uploading ? '#ccc' : '#1a1a1a', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '18px', fontWeight: 'bold' }}>
              {uploading ? statusMsg : '送信を確定する'}
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '20px' }}>調査ギャラリー</h2>
              <button onClick={() => setScreen('home')} style={{ background: '#fff', border: '1px solid #ddd', padding: '5px 15px', borderRadius: '8px' }}>戻る</button>
            </div>
            {posts.length === 0 ? <p style={{ textAlign: 'center', color: '#999', marginTop: '50px' }}>まだ投稿がありません。</p> : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                {posts.map(p => (
                  <div key={p.id} style={{ background: '#fff', borderRadius: '15px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                    <img src={p.photo_url} style={{ width: '100%', height: 'auto', display: 'block' }} loading="lazy" />
                    <div style={{ padding: '15px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#0070f3', background: '#e7f3ff', padding: '2px 8px', borderRadius: '10px' }}>{p.group_name}</span>
                          <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>投稿者: {p.user_id}</div>
                        </div>
                        {(role === 'teacher' || p.user_id === userId) && (
                          <button onClick={() => handleDelete(p.id)} style={{ color: '#ff4d4f', background: 'none', border: 'none', fontSize: '12px', cursor: 'pointer' }}>削除</button>
                        )}
                      </div>
                      <p style={{ margin: '12px 0', fontSize: '15px', lineHeight: '1.5' }}>{p.theme}</p>
                      {p.audio_url && <audio src={p.audio_url} controls style={{ width: '100%', height: '35px' }} />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
      <footer style={{ textAlign: 'center', padding: '20px', color: '#999', fontSize: '11px' }}>PhotoVox Field Research System v3.1</footer>
    </div>
  )
}