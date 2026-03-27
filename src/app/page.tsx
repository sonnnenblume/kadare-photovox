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
  const [uploading, setUploading] = useState(false)
  
  // 録音用ステート
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  // 🔄 ログイン情報の復元（更新しても消えません）
  useEffect(() => {
    const savedId = localStorage.getItem('photovox_id');
    const savedRole = localStorage.getItem('photovox_role') as any;
    if (savedId && savedRole) {
      setUserId(savedId);
      setRole(savedRole);
    }
  }, []);

  // 🔐 ログイン処理（ゆらぎ吸収ロジック搭載）
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

  // 📝 データ取得
  const loadPosts = async () => {
    try {
      const { data, error } = await supabase.from('posts').select('*');
      if (error) throw error;
      const sorted = (data || []).sort((a, b) => (b.id || 0) - (a.id || 0));

      // 権限フィルタリング
      if (role === 'viewer') {
        setPosts(sorted.filter(p => p.group_name?.toLowerCase() === userId.toLowerCase()));
      } else {
        setPosts(sorted);
      }
    } catch (e) { console.warn("Fetch Error", e); }
  };

  useEffect(() => {
    if (screen === 'gallery' && role) loadPosts();
  }, [screen, role]);

  // 🗑️ 削除機能（先生は全件、学生は自件のみ）
  const handleDelete = async (postId: number) => {
    if (!confirm('この調査報告を完全に削除しますか？')) return;
    try {
      const { error } = await supabase.from('posts').delete().eq('id', postId);
      if (error) throw error;
      alert('削除しました');
      loadPosts();
    } catch (e: any) { alert('削除に失敗しました: ' + e.message); }
  };

  // 🎤 録音・📤 アップロード（省略せずフル記述）
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

  const handleUpload = async () => {
    if (!uploadGroup || !imageFile) return alert('班と写真を選択してください');
    setUploading(true);
    try {
      const ts = Date.now();
      const imgPath = `photo_${ts}.jpg`;
      await supabase.storage.from('photos').upload(imgPath, imageFile);
      const photoUrl = `${supabaseUrl}/storage/v1/object/public/photos/${imgPath}`;
      let audioUrl = "";
      if (audioBlob) {
        const audPath = `audio_${ts}.webm`;
        await supabase.storage.from('photos').upload(audPath, audioBlob);
        audioUrl = `${supabaseUrl}/storage/v1/object/public/photos/${audPath}`;
      }
      await supabase.from('posts').insert([{
        user_id: userId, group_name: uploadGroup, theme: comment, photo_url: photoUrl, audio_url: audioUrl
      }]);
      alert('報告を送信しました！');
      setComment(''); setImageFile(null); setAudioBlob(null); setScreen('gallery');
    } catch (e: any) { alert("送信エラー: " + e.message); } finally { setUploading(false); }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', minHeight: '100vh', background: '#f4f7f9', fontFamily: 'sans-serif' }}>
      <header style={{ background: '#000', color: '#fff', padding: '18px', textAlign: 'center', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
        <h1 style={{ margin: 0, fontSize: '22px', letterSpacing: '2px' }}>PHOTOVOX</h1>
        {role && <div style={{ fontSize: '10px', marginTop: '4px', opacity: 0.7 }}>USER: {userId} ({role})</div>}
      </header>

      <main style={{ padding: '20px' }}>
        {!role ? (
          <div style={{ background: '#fff', padding: '40px 25px', borderRadius: '25px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', marginTop: '50px', textAlign: 'center' }}>
            <h2 style={{ marginBottom: '30px', fontWeight: 'bold' }}>演習用ログイン</h2>
            <input type="text" placeholder="学籍番号 または 班名" value={userId} onChange={e => setUserId(e.target.value)} style={{ width: '100%', padding: '18px', fontSize: '18px', border: '2px solid #eee', borderRadius: '15px', marginBottom: '20px', boxSizing: 'border-box' }} />
            <button onClick={handleLogin} style={{ width: '100%', padding: '18px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: '15px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>アプリを開始</button>
          </div>
        ) : screen === 'home' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '40px' }}>
            {role === 'student' && (
              <button onClick={() => setScreen('upload')} style={{ padding: '60px 20px', fontSize: '24px', background: '#fff', border: 'none', borderRadius: '30px', boxShadow: '0 8px 20px rgba(0,0,0,0.06)', fontWeight: 'bold' }}>📷 調査報告を投稿</button>
            )}
            <button onClick={() => setScreen('gallery')} style={{ padding: '60px 20px', fontSize: '24px', background: '#000', color: '#fff', border: 'none', borderRadius: '30px', boxShadow: '0 8px 20px rgba(0,0,0,0.2)', fontWeight: 'bold' }}>📂 ギャラリーを見る</button>
            <button onClick={() => {localStorage.clear(); location.reload();}} style={{ marginTop: '30px', color: '#999', background: 'none', border: 'none', textDecoration: 'underline' }}>ログアウト</button>
          </div>
        ) : screen === 'upload' ? (
          <div style={{ background: '#fff', padding: '25px', borderRadius: '25px', border: '1px solid #eee' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
              <h3 style={{ margin: 0 }}>新規報告作成</h3>
              <button onClick={() => setScreen('home')} style={{ background: '#f0f0f0', border: 'none', padding: '8px 15px', borderRadius: '10px' }}>戻る</button>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>1. 班の選択</label>
              <select value={uploadGroup} onChange={e => setUploadGroup(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '2px solid #f0f0f0' }}>
                <option value="">-- 選択してください --</option>
                {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>2. 写真撮影</label>
              <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>3. 音声コメント</label>
              <div style={{ background: '#f8fbff', padding: '20px', borderRadius: '15px', textAlign: 'center', border: '1px dashed #0070f3' }}>
                {!isRecording ? <button onClick={startRecording}>🎤 録音開始</button> : <button onClick={stopRecording} style={{ color: 'red' }}>🛑 録音停止</button>}
                {audioBlob && <div style={{ marginTop: '10px', color: '#52c41a', fontWeight: 'bold' }}>✅ 録音完了</div>}
              </div>
            </div>

            <div style={{ marginBottom: '30px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>4. 調査メモ</label>
              <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="気づいた点などを入力" style={{ width: '100%', height: '100px', padding: '12px', border: '2px solid #f0f0f0', borderRadius: '12px', boxSizing: 'border-box' }} />
            </div>

            <button onClick={handleUpload} disabled={uploading} style={{ width: '100%', padding: '20px', background: uploading ? '#ccc' : '#0070f3', color: '#fff', border: 'none', borderRadius: '15px', fontSize: '20px', fontWeight: 'bold' }}>
              {uploading ? '送信中...' : '報告を確定する'}
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>調査ギャラリー</h2>
              <button onClick={() => setScreen('home')} style={{ padding: '8px 15px', background: '#fff', border: '1px solid #ddd', borderRadius: '10px' }}>戻る</button>
            </div>
            {posts.length === 0 ? <p style={{ textAlign: 'center', color: '#999', marginTop: '100px' }}>まだ投稿がありません。</p> : (
              <div style={{ display: 'grid', gap: '20px' }}>
                {posts.map(p => (
                  <div key={p.id} style={{ background: '#fff', borderRadius: '25px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                    <img src={p.photo_url} style={{ width: '100%', height: 'auto', maxHeight: '400px', objectFit: 'cover' }} />
                    <div style={{ padding: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div>
                          <span style={{ background: '#0070f3', color: '#fff', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>{p.group_name}</span>
                          <div style={{ fontSize: '11px', color: '#999', marginTop: '5px' }}>投稿者 ID: {p.user_id}</div>
                        </div>
                        {/* 🗑️ 削除ボタンの表示判定ロジック */}
                        {(role === 'teacher' || p.user_id === userId) && (
                          <button onClick={() => handleDelete(p.id)} style={{ background: '#fff', color: '#ff4d4f', border: '1px solid #ff4d4f', padding: '5px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>削除</button>
                        )}
                      </div>
                      <p style={{ margin: '15px 0', fontSize: '15px', lineHeight: '1.6' }}>{p.theme}</p>
                      {p.audio_url && <audio src={p.audio_url} controls style={{ width: '100%', height: '40px' }} />}
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