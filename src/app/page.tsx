'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

// --- 接続設定 ---
const supabaseUrl = 'https://zlpcaxrjwlbrisyurfdr.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpscGNheHJqd2xicmlzeXVyZmRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTkxNTcsImV4cCI6MjA5MDA5NTE1N30.BT4yx6ipKUvM-nieU0d0ofbiUqUE7hY4Q3x1EYI_Bs8'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// --- グループ定義 ---
const GROUPS = ['GroupA','GroupB','GroupC','GroupD','GroupE','GroupF','GroupG','GroupH']

export default function Home() {
  const [role, setRole] = useState<'student' | 'viewer' | 'teacher' | null>(null)
  const [userId, setUserId] = useState('')
  const [screen, setScreen] = useState<'home' | 'upload' | 'gallery'>('home')
  const [posts, setPosts] = useState<any[]>([])
  
  // 入力フォーム用
  const [uploadGroup, setUploadGroup] = useState('')
  const [comment, setComment] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  
  // 録音用
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  // 🔄 初期化：ブラウザの保存情報からログイン状態を復元
  useEffect(() => {
    const savedId = localStorage.getItem('photovox_id');
    const savedRole = localStorage.getItem('photovox_role') as any;
    if (savedId && savedRole) {
      setUserId(savedId);
      setRole(savedRole);
    }
  }, []);

  // 🔐 ログイン処理
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

  // 📝 データ取得
  const loadPosts = async () => {
    try {
      const { data, error } = await supabase.from('posts').select('*');
      if (error) throw error;

      // 日付の降順でソート
      const sorted = (data || []).sort((a, b) => (b.id || 0) - (a.id || 0));

      // 権限によるフィルタリング（大文字小文字を無視して確実にマッチさせる）
      if (userRole === 'teacher') {
        setPosts(sorted);
      } else if (userRole === 'viewer') {
        setPosts(sorted.filter(p => p.group_name?.toLowerCase() === userId.toLowerCase()));
      } else {
        setPosts(sorted.filter(p => p.user_id === userId));
      }
    } catch (e) {
      console.warn("Fetch Error", e);
    }
  };

  // 画面がギャラリーに切り替わった時にロード
  useEffect(() => {
    if (screen === 'gallery' && role) loadPosts();
  }, [screen, role]);

  // 🎤 録音関連
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
    } catch (e) { alert("マイクの許可設定を確認してください"); }
  };
  const stopRecording = () => { mediaRecorderRef.current?.stop(); setIsRecording(false); };

  // 📤 アップロード処理
  const handleUpload = async () => {
    if (!uploadGroup || !imageFile) return alert('班と写真を選択してください');
    setUploading(true);
    try {
      const ts = Date.now();
      const imgPath = `photo_${ts}.jpg`;
      const { error: s1 } = await supabase.storage.from('photos').upload(imgPath, imageFile);
      if (s1) throw s1;
      const photoUrl = `${supabaseUrl}/storage/v1/object/public/photos/${imgPath}`;

      let audioUrl = "";
      if (audioBlob) {
        const audPath = `audio_${ts}.webm`;
        await supabase.storage.from('photos').upload(audPath, audioBlob);
        audioUrl = `${supabaseUrl}/storage/v1/object/public/photos/${audPath}`;
      }

      const { error: dbErr } = await supabase.from('posts').insert([{
        user_id: userId, group_name: uploadGroup, theme: comment, photo_url: photoUrl, audio_url: audioUrl
      }]);
      if (dbErr) throw dbErr;

      alert('投稿が完了しました！');
      setComment(''); setImageFile(null); setAudioBlob(null); setScreen('gallery');
    } catch (e: any) {
      alert("エラーが発生しました: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    if(confirm("ログアウトして入力情報を消去しますか？")) {
      localStorage.clear();
      location.reload();
    }
  };

  const userRole = role; // 内部判定用

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', minHeight: '100vh', background: '#f0f2f5', color: '#1c1e21', fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      {/* ヘッダー */}
      <header style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #333 100%)', color: '#fff', padding: '20px 15px', textAlign: 'center', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', letterSpacing: '1px' }}>PhotoVox</h1>
        {role && (
          <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '5px' }}>
            ID: {userId} <span style={{ marginLeft: '10px', padding: '2px 6px', background: 'rgba(255,255,255,0.2)', borderRadius: '4px' }}>{role.toUpperCase()}</span>
          </div>
        )}
      </header>

      <main style={{ padding: '20px' }}>
        {/* ログイン画面 */}
        {!role ? (
          <div style={{ background: '#fff', padding: '40px 30px', borderRadius: '24px', boxShadow: '0 8px 30px rgba(0,0,0,0.1)', marginTop: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: '50px', marginBottom: '20px' }}>📸</div>
            <h2 style={{ marginBottom: '30px', color: '#000' }}>調査システムへようこそ</h2>
            <div style={{ textAlign: 'left', marginBottom: '25px' }}>
              <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#555' }}>学籍番号 または 班名</label>
              <input type="text" value={userId} onChange={e => setUserId(e.target.value)} placeholder="入力してください" style={{ width: '100%', padding: '16px', fontSize: '18px', border: '2px solid #ddd', borderRadius: '12px', marginTop: '8px', boxSizing: 'border-box', outline: 'none' }} />
            </div>
            <button onClick={handleLogin} style={{ width: '100%', padding: '18px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}>
              調査を開始する
            </button>
            <p style={{ fontSize: '12px', color: '#999', marginTop: '20px' }}>秋田大学 演習用システム v2.0</p>
          </div>
        ) : screen === 'home' ? (
          /* ホーム画面 */
          <div style={{ marginTop: '30px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
              {role === 'student' && (
                <button onClick={() => setScreen('upload')} style={{ padding: '60px 20px', fontSize: '24px', background: '#fff', color: '#000', border: 'none', borderRadius: '28px', boxShadow: '0 10px 25px rgba(0,0,0,0.08)', cursor: 'pointer', fontWeight: 'bold' }}>
                  <span style={{ display: 'block', fontSize: '40px', marginBottom: '10px' }}>📷</span>
                  調査結果を報告する
                </button>
              )}
              <button onClick={() => setScreen('gallery')} style={{ padding: '60px 20px', fontSize: '24px', background: '#000', color: '#fff', border: 'none', borderRadius: '28px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', cursor: 'pointer', fontWeight: 'bold' }}>
                <span style={{ display: 'block', fontSize: '40px', marginBottom: '10px' }}>📂</span>
                ギャラリーを閲覧
              </button>
              <button onClick={handleLogout} style={{ marginTop: '40px', background: 'none', border: 'none', color: '#ff4d4f', fontSize: '16px', cursor: 'pointer', textDecoration: 'underline' }}>
                ログアウト
              </button>
            </div>
          </div>
        ) : screen === 'upload' ? (
          /* 投稿画面 */
          <div style={{ background: '#fff', padding: '25px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', paddingBottom: '15px', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>新規調査報告</h3>
              <button onClick={() => setScreen('home')} style={{ background: '#eee', border: 'none', padding: '5px 15px', borderRadius: '8px' }}>戻る</button>
            </div>
            
            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '10px' }}>1. 班の選択</label>
              <select value={uploadGroup} onChange={e => setUploadGroup(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '2px solid #eee', fontSize: '16px' }}>
                <option value="">-- 班を選択してください --</option>
                {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '10px' }}>2. 写真の撮影</label>
              <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} style={{ width: '100%', padding: '10px', background: '#f9f9f9', borderRadius: '10px' }} />
            </div>

            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '10px' }}>3. 声で伝える</label>
              <div style={{ background: '#f0f7ff', padding: '25px', borderRadius: '20px', textAlign: 'center' }}>
                {!isRecording ? (
                  <button onClick={startRecording} style={{ padding: '12px 30px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: '30px', fontSize: '16px', cursor: 'pointer' }}>🎤 録音を開始</button>
                ) : (
                  <button onClick={stopRecording} style={{ padding: '12px 30px', background: '#ff4d4f', color: '#fff', border: 'none', borderRadius: '30px', fontSize: '16px', cursor: 'pointer' }}>🛑 停止する</button>
                )}
                {audioBlob && <div style={{ color: '#52c41a', marginTop: '10px', fontWeight: 'bold' }}>✅ 録音済み</div>}
              </div>
            </div>

            <div style={{ marginBottom: '30px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '10px' }}>4. 調査メモ（気づき）</label>
              <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="例：〇〇付近で発見。保存状態が良い。" style={{ width: '100%', height: '120px', padding: '15px', border: '2px solid #eee', borderRadius: '12px', boxSizing: 'border-box' }} />
            </div>

            <button onClick={handleUpload} disabled={uploading} style={{ width: '100%', padding: '20px', background: uploading ? '#ccc' : '#0070f3', color: '#fff', border: 'none', borderRadius: '15px', fontSize: '20px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,112,243,0.3)' }}>
              {uploading ? '送信しています...' : '報告を送信する'}
            </button>
          </div>
        ) : (
          /* ギャラリー画面 */
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>調査ギャラリー</h2>
              <button onClick={() => setScreen('home')} style={{ padding: '8px 20px', borderRadius: '10px', background: '#fff', border: '1px solid #ddd' }}>戻る</button>
            </div>
            
            {posts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '100px 20px', color: '#999' }}>まだ投稿がありません。最初の報告を送りましょう！</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                {posts.map(p => (
                  <div key={p.id} style={{ background: '#fff', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                    <img src={p.photo_url} style={{ width: '100%', maxHeight: '400px', objectFit: 'cover' }} />
                    <div style={{ padding: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span style={{ padding: '4px 12px', background: '#e7f3ff', color: '#0070f3', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold' }}>{p.group_name}</span>
                        <span style={{ fontSize: '12px', color: '#999' }}>ID: {p.user_id}</span>
                      </div>
                      <p style={{ fontSize: '16px', lineHeight: '1.6', margin: '15px 0' }}>{p.theme}</p>
                      {p.audio_url && (
                        <div style={{ background: '#f8f9fa', padding: '10px', borderRadius: '12px' }}>
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
    </div>
  )
}