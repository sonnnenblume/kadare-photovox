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
  
  // 投稿用ステート
  const [uploadGroup, setUploadGroup] = useState('')
  const [comment, setComment] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [statusMsg, setStatusMsg] = useState('')
  const [uploading, setUploading] = useState(false)
  
  // 録音用ステート
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  // 🔄 HEIC変換ライブラリの動的読み込み
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
    if (savedId && savedRole) {
      setUserId(savedId);
      setRole(savedRole);
    }
  }, []);

  const handleLogin = () => {
    const rawId = userId.trim().replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    if (!rawId) return alert('入力してください');

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
      
      // ✨ URL修復：以前の非公開リンクも全て最新のPublic URLに変換して表示
      const repaired = (data || []).map(p => {
        const fix = (url: string) => {
          if(!url) return "";
          const fileName = url.split('/').pop();
          return `${supabaseUrl}/storage/v1/object/public/photos/${fileName}`;
        }
        return { ...p, photo_url: fix(p.photo_url), audio_url: fix(p.audio_url) };
      });

      const sorted = repaired.sort((a, b) => (b.id || 0) - (a.id || 0));
      setPosts(role === 'viewer' ? sorted.filter(p => p.group_name?.toLowerCase() === userId.toLowerCase()) : sorted);
    } catch (e) { console.warn(e); }
  };

  useEffect(() => { if (screen === 'gallery' && role) loadPosts(); }, [screen, role]);

  const handleDelete = async (postId: number) => {
    if (!confirm('この投稿を完全に削除しますか？')) return;
    try {
      await supabase.from('posts').delete().eq('id', postId);
      alert('削除しました');
      loadPosts();
    } catch (e) { alert('削除に失敗しました'); }
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
    } catch (e) { alert("マイク使用を許可してください"); }
  };
  const stopRecording = () => { mediaRecorderRef.current?.stop(); setIsRecording(false); };

  const handleUpload = async () => {
    if (!uploadGroup || !imageFile) return alert('班と写真を選択してください');
    setUploading(true);
    setStatusMsg('準備中...');
    
    try {
      let fileToUpload = imageFile;
      
      // ✨ HEIC対応：iPhoneの写真なら自動変換
      if (imageFile.name.toLowerCase().endsWith('.heic')) {
        setStatusMsg('iPhone形式を変換中...');
        const blob = await (window as any).heic2any({ blob: imageFile, toType: "image/jpeg", quality: 0.7 });
        fileToUpload = new File([Array.isArray(blob) ? blob[0] : blob], imageFile.name.replace(/\.heic/i, '.jpg'), { type: "image/jpeg" });
      }

      setStatusMsg('画像を送信中...');
      const ts = Date.now();
      const imgPath = `photo_${ts}.jpg`;
      await supabase.storage.from('photos').upload(imgPath, fileToUpload);

      let audioUrl = "";
      if (audioBlob) {
        setStatusMsg('音声を送信中...');
        const audPath = `audio_${ts}.webm`;
        await supabase.storage.from('photos').upload(audPath, audioBlob);
        audioUrl = audPath; // DBにはファイル名だけ保存（表示時に修復）
      }

      setStatusMsg('データを保存中...');
      await supabase.from('posts').insert([{
        user_id: userId, group_name: uploadGroup, theme: comment, 
        photo_url: imgPath, audio_url: audioUrl
      }]);

      alert('調査報告を受け付けました！');
      setComment(''); setImageFile(null); setAudioBlob(null); setScreen('gallery');
    } catch (e: any) {
      alert("エラーが発生しました: " + e.message);
    } finally {
      setUploading(false);
      setStatusMsg('');
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', minHeight: '100vh', background: '#f4f7f6', color: '#333', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* ヘッダー */}
      <header style={{ background: 'linear-gradient(to right, #1a1a1a, #444)', color: '#fff', padding: '20px', textAlign: 'center', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '800', letterSpacing: '2px' }}>PhotoVox <span style={{fontSize:'12px', fontWeight:'normal', opacity:0.7}}>v3.0</span></h1>
        {role && <div style={{ fontSize: '12px', marginTop: '5px', background: 'rgba(255,255,255,0.1)', display: 'inline-block', padding: '2px 10px', borderRadius: '10px' }}>ID: {userId} ({role})</div>}
      </header>

      <main style={{ padding: '20px' }}>
        {/* ログイン画面 */}
        {!role ? (
          <div style={{ background: '#fff', padding: '40px 30px', borderRadius: '30px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', marginTop: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: '60px', marginBottom: '20px' }}>🔍</div>
            <h2 style={{ marginBottom: '30px' }}>フィールド調査ログイン</h2>
            <input type="text" placeholder="学籍番号 または 班名" value={userId} onChange={e => setUserId(e.target.value)} style={{ width: '100%', padding: '18px', fontSize: '18px', border: '2px solid #eee', borderRadius: '15px', marginBottom: '20px', boxSizing: 'border-box', outline: 'none' }} />
            <button onClick={handleLogin} style={{ width: '100%', padding: '18px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: '15px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', transition: '0.3s' }}>調査を開始する</button>
          </div>
        ) : screen === 'home' ? (
          /* メインメニュー */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '40px' }}>
            {role === 'student' && (
              <button onClick={() => setScreen('upload')} style={{ padding: '60px 20px', fontSize: '24px', background: '#fff', border: 'none', borderRadius: '30px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', cursor: 'pointer', fontWeight: 'bold' }}>
                <span style={{ display: 'block', fontSize: '40px', marginBottom: '10px' }}>📸</span> 調査報告を投稿
              </button>
            )}
            <button onClick={() => setScreen('gallery')} style={{ padding: '60px 20px', fontSize: '24px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '30px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', cursor: 'pointer', fontWeight: 'bold' }}>
              <span style={{ display: 'block', fontSize: '40px', marginBottom: '10px' }}>📂</span> ギャラリーを閲覧
            </button>
            <button onClick={() => {localStorage.clear(); location.reload();}} style={{ marginTop: '40px', background: 'none', border: 'none', color: '#999', textDecoration: 'underline', cursor: 'pointer' }}>ログアウト（別のIDで入る）</button>
          </div>
        ) : screen === 'upload' ? (
          /* 投稿フォーム */
          <div style={{ background: '#fff', padding: '25px', borderRadius: '30px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
              <h3 style={{ margin: 0 }}>新規報告作成</h3>
              <button onClick={() => setScreen('home')} style={{ background: '#f0f0f0', border: 'none', padding: '8px 15px', borderRadius: '10px' }}>キャンセル</button>
            </div>
            
            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '10px' }}>① 担当班</label>
              <select value={uploadGroup} onChange={e => setUploadGroup(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '15px', border: '2px solid #f0f0f0', fontSize: '16px' }}>
                <option value="">選択してください</option>
                {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '10px' }}>② 写真（JPEG/HEIC対応）</label>
              <input type="file" accept="image/*,.heic" onChange={e => setImageFile(e.target.files?.[0] || null)} style={{ width: '100%' }} />
            </div>

            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '10px' }}>③ 音声コメント（任意）</label>
              <div style={{ background: '#f0f7ff', padding: '20px', borderRadius: '20px', textAlign: 'center', border: '2px dashed #0070f3' }}>
                {!isRecording ? (
                  <button onClick={startRecording} style={{ padding: '10px 25px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: '20px', cursor: 'pointer' }}>🎤 録音を開始</button>
                ) : (
                  <button onClick={stopRecording} style={{ padding: '10px 25px', background: '#ff4d4f', color: '#fff', border: 'none', borderRadius: '20px', cursor: 'pointer' }}>🛑 録音を停止</button>
                )}
                {audioBlob && <div style={{ marginTop: '10px', color: '#52c41a', fontWeight: 'bold' }}>✅ 録音完了</div>}
              </div>
            </div>

            <div style={{ marginBottom: '30px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '10px' }}>④ 調査メモ</label>
              <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="場所や気づいた点" style={{ width: '100%', height: '100px', padding: '15px', border: '2px solid #f0f0f0', borderRadius: '15px', boxSizing: 'border-box', outline: 'none' }} />
            </div>

            <button onClick={handleUpload} disabled={uploading} style={{ width: '100%', padding: '20px', background: uploading ? '#ccc' : '#0070f3', color: '#fff', border: 'none', borderRadius: '20px', fontSize: '20px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 5px 15px rgba(0,112,243,0.3)' }}>
              {uploading ? statusMsg : '報告を確定する'}
            </button>
          </div>
        ) : (
          /* ギャラリー表示 */
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>調査結果一覧</h2>
              <button onClick={() => setScreen('home')} style={{ padding: '8px 20px', background: '#fff', border: '1px solid #ddd', borderRadius: '10px' }}>メニューへ戻る</button>
            </div>
            {posts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '100px 0', color: '#999' }}>まだ投稿がありません。</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '25px' }}>
                {posts.map(p => (
                  <div key={p.id} style={{ background: '#fff', borderRadius: '25px', overflow: 'hidden', boxShadow: '0 5px 15px rgba(0,0,0,0.05)' }}>
                    <img src={p.photo_url} style={{ width: '100%', height: 'auto', display: 'block' }} alt="調査写真" />
                    <div style={{ padding: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                        <div>
                          <span style={{ background: '#e7f3ff', color: '#0070f3', padding: '4px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold' }}>{p.group_name}</span>
                          <div style={{ fontSize: '11px', color: '#999', marginTop: '6px' }}>投稿者: {p.user_id}</div>
                        </div>
                        {(role === 'teacher' || p.user_id === userId) && (
                          <button onClick={() => handleDelete(p.id)} style={{ background: '#fff0f0', color: '#ff4d4f', border: '1px solid #ffccc7', padding: '5px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>削除</button>
                        )}
                      </div>
                      <p style={{ margin: '15px 0', fontSize: '16px', lineHeight: '1.6', color: '#444' }}>{p.theme}</p>
                      {p.audio_url && (
                        <div style={{ background: '#f8f9fa', padding: '10px', borderRadius: '15px' }}>
                          <audio src={p.audio_url} controls style={{ width: '100%', height: '40px' }} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
      <footer style={{ textAlign: 'center', padding: '20px', color: '#bbb', fontSize: '12px' }}>
        Akita University - Field Research Support System
      </footer>
    </div>
  )
}