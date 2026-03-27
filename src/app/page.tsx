'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

// 先生の正しい接続情報
const supabaseUrl = 'https://zlpcaxrjwlbrisyurfdr.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpscGNheHJqd2xicmlzeXVyZmRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTkxNTcsImV4cCI6MjA5MDA5NTE1N30.BT4yx6ipKUvM-nieU0d0ofbiUqUE7hY4Q3x1EYI_Bs8'

const supabase = createClient(supabaseUrl, supabaseAnonKey)
const GROUPS = ['GroupA','GroupB','GroupC','GroupD','GroupE','GroupF','GroupG','GroupH']

export default function Home() {
  const [role, setRole] = useState<'student' | 'viewer' | 'teacher' | null>(null)
  const [userId, setUserId] = useState('')
  const [screen, setScreen] = useState<'home' | 'upload' | 'gallery'>('home')
  const [posts, setPosts] = useState<any[]>([])
  const [uploadGroup, setUploadGroup] = useState('')
  const [comment, setComment] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  // ログイン処理（全角数字も半角に直す親切設計）
  const handleLogin = () => {
    const id = userId.trim().replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    if (!id) return alert('学籍番号を入力してください');

    let userRole: 'student' | 'viewer' | 'teacher' = (id === '0526') ? 'teacher' : (GROUPS.some(g => g.toLowerCase() === id.toLowerCase()) ? 'viewer' : 'student');
    const finalId = userRole === 'viewer' ? GROUPS.find(g => g.toLowerCase() === id.toLowerCase()) || id : id;
    
    setUserId(finalId);
    setRole(userRole);
  }

  // データ取得（DBに列がない等のエラーも優しく無視して動かし続ける）
  const loadPosts = async () => {
    try {
      const { data, error } = await supabase.from('posts').select('*');
      if (error) throw error;

      const sortedData = (data || []).sort((a, b) => (b.id || 0) - (a.id || 0));
      
      // 役割に応じて表示を切り分け
      if (role === 'teacher') {
        setPosts(sortedData);
      } else if (role === 'viewer') {
        setPosts(sortedData.filter(p => p.group_name === userId));
      } else {
        setPosts(sortedData.filter(p => p.user_id === userId));
      }
    } catch (e: any) {
      console.warn("Silent failure to load posts:", e.message);
      setPosts([]); // エラー時は空にするだけで画面は止めない
    }
  }

  useEffect(() => {
    if (screen === 'gallery' && role) loadPosts();
  }, [screen, role]);

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
    } catch (e) { alert("マイクの許可が必要です。設定を確認してください。"); }
  }
  const stopRecording = () => { mediaRecorderRef.current?.stop(); setIsRecording(false); }

  const handleUpload = async () => {
    if (!uploadGroup || !imageFile) return alert('班と写真を選択してください');
    setUploading(true);
    try {
      const ts = Date.now();
      const imgPath = `photo_${ts}.jpg`;
      const { error: storageErr } = await supabase.storage.from('photos').upload(imgPath, imageFile);
      if (storageErr) throw storageErr;
      
      const photoUrl = `${supabaseUrl}/storage/v1/object/public/photos/${imgPath}`;
      let audioUrl = "";
      if (audioBlob) {
        const audPath = `audio_${ts}.webm`;
        await supabase.storage.from('photos').upload(audPath, audioBlob);
        audioUrl = `${supabaseUrl}/storage/v1/object/public/photos/${audPath}`;
      }

      const { error: dbErr } = await supabase.from('posts').insert([{
        user_id: userId,
        group_name: uploadGroup,
        theme: comment,
        photo_url: photoUrl,
        audio_url: audioUrl
      }]);
      if (dbErr) throw dbErr;

      alert('調査報告が投稿されました！');
      setComment(''); setImageFile(null); setAudioBlob(null); setScreen('gallery');
    } catch (e: any) {
      alert("送信エラー: " + e.message + "\n(DBの列名が posts, group_name, theme であるか再確認してください)");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', minHeight: '100vh', background: '#fcfcfc', color: '#333', fontFamily: 'sans-serif' }}>
      <header style={{ background: '#1a1a1a', color: '#fff', padding: '20px', textAlign: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
        <h1 style={{ margin: 0, fontSize: '24px', letterSpacing: '1px' }}>PhotoVox System</h1>
        {role && <div style={{ fontSize: '12px', marginTop: '5px' }}>Logged in as: {userId} ({role})</div>}
      </header>

      <main style={{ padding: '20px' }}>
        {!role ? (
          <div style={{ background: '#fff', padding: '40px 20px', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', marginTop: '40px' }}>
            <h2 style={{ textAlign: 'center', marginBottom: '30px' }}>演習用ログイン</h2>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '14px', color: '#666' }}>学籍番号または班名を入力</label>
              <input type="text" placeholder="例: 123456" value={userId} onChange={e => setUserId(e.target.value)} style={{ width: '100%', padding: '15px', fontSize: '18px', border: '1px solid #ddd', borderRadius: '10px', marginTop: '5px', boxSizing: 'border-box' }} />
            </div>
            <button onClick={handleLogin} style={{ width: '100%', padding: '18px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>アプリを開始する</button>
          </div>
        ) : screen === 'home' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '40px' }}>
            {role === 'student' && (
              <button onClick={() => setScreen('upload')} style={{ padding: '50px 20px', fontSize: '22px', background: '#000', color: '#fff', border: 'none', borderRadius: '20px', boxShadow: '0 10px 20px rgba(0,0,0,0.1)', cursor: 'pointer' }}>
                📷 調査報告を投稿する
              </button>
            )}
            <button onClick={() => setScreen('gallery')} style={{ padding: '50px 20px', fontSize: '22px', background: '#fff', border: '3px solid #000', borderRadius: '20px', boxShadow: '0 10px 20px rgba(0,0,0,0.05)', cursor: 'pointer' }}>
              📂 ギャラリーを閲覧する
            </button>
            <button onClick={() => location.reload()} style={{ marginTop: '30px', background: 'none', border: 'none', color: '#999', textDecoration: 'underline', cursor: 'pointer' }}>ログアウト</button>
          </div>
        ) : screen === 'upload' ? (
          <div style={{ background: '#fff', padding: '25px', borderRadius: '20px', border: '1px solid #eee' }}>
            <h3 style={{ marginTop: 0, borderBottom: '2px solid #000', paddingBottom: '10px' }}>新規調査報告</h3>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>1. 担当班の選択</label>
              <select value={uploadGroup} onChange={e => setUploadGroup(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc' }}>
                <option value="">選択してください</option>
                {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>2. 写真の撮影・選択</label>
              <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>3. 音声ガイダンスの録音</label>
              <div style={{ background: '#f0f7ff', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
                {!isRecording ? (
                  <button onClick={startRecording} style={{ padding: '10px 25px', borderRadius: '30px', border: 'none', background: '#0070f3', color: '#fff', cursor: 'pointer' }}>🎤 録音開始</button>
                ) : (
                  <button onClick={stopRecording} style={{ padding: '10px 25px', borderRadius: '30px', border: 'none', background: '#ff4d4f', color: '#fff', cursor: 'pointer' }}>🛑 録音停止</button>
                )}
                {audioBlob && <div style={{ marginTop: '10px', color: '#52c41a', fontWeight: 'bold' }}>✅ 録音完了</div>}
              </div>
            </div>
            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>4. 調査メモ（気づき）</label>
              <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="ここに入力..." style={{ width: '100%', height: '100px', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
            </div>
            <button onClick={handleUpload} disabled={uploading} style={{ width: '100%', padding: '20px', background: uploading ? '#ccc' : '#000', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>
              {uploading ? '送信中...' : '調査報告を送信する'}
            </button>
            <p onClick={() => setScreen('home')} style={{ textAlign: 'center', marginTop: '20px', cursor: 'pointer', color: '#666' }}>キャンセルして戻る</p>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>調査ギャラリー</h2>
              <button onClick={() => setScreen('home')} style={{ padding: '8px 15px', borderRadius: '8px' }}>戻る</button>
            </div>
            {posts.length === 0 ? <p style={{ textAlign: 'center', color: '#999', marginTop: '50px' }}>まだ投稿がありません。</p> : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                {posts.map(p => (
                  <div key={p.id} style={{ background: '#fff', borderRadius: '15px', border: '1px solid #eee', overflow: 'hidden', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
                    <img src={p.photo_url} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover' }} />
                    <div style={{ padding: '12px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#0070f3' }}>{p.group_name}</div>
                      <div style={{ fontSize: '11px', color: '#999', marginBottom: '8px' }}>By {p.user_id}</div>
                      <p style={{ margin: '0 0 10px 0', fontSize: '13px', lineHeight: '1.4' }}>{p.theme}</p>
                      {p.audio_url && <audio src={p.audio_url} controls style={{ width: '100%', height: '35px' }} />}
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