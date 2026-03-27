'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

// ★ ここを正確に書き換えてください（空白や改行が入らないよう注意）
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

  // 録音用ステート（確実に初期化）
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  const handleLogin = () => {
    const id = userId.trim().replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    if (!id) return alert('学籍番号を入力してください');
    let userRole: 'student' | 'viewer' | 'teacher' = (id === '0526') ? 'teacher' : (GROUPS.some(g => g.toLowerCase() === id.toLowerCase()) ? 'viewer' : 'student');
    if (userRole === 'viewer') {
      setUserId(GROUPS.find(g => g.toLowerCase() === id.toLowerCase()) || id);
    } else {
      setUserId(id);
    }
    setRole(userRole);
  }

  const loadPosts = async () => {
    try {
      const { data, error } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (role === 'teacher') setPosts(data || []);
      else if (role === 'viewer') setPosts(data?.filter(p => p.group_name === userId) || []);
      else setPosts(data?.filter(p => p.user_id === userId) || []);
    } catch (e: any) {
      console.error("Fetch Error:", e);
      alert("読み込みエラーが発生しました。接続を確認してください。");
    }
  }

  useEffect(() => {
    if (screen === 'gallery' && role) loadPosts();
  }, [screen, role]);

  // 🎤 録音開始（安全なエラー処理）
  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices) throw new Error("このブラウザは録音に対応していません");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => { setAudioBlob(new Blob(chunks, { type: 'audio/webm' })); };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (e: any) {
      alert("マイクの起動に失敗しました: " + e.message);
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop()); // マイクを確実に切る
    }
  }

  // 📤 アップロード（写真＋音声）
  const handleUpload = async () => {
    if (!uploadGroup || !imageFile) return alert('班と写真を選択してください');
    setUploading(true);
    try {
      const timestamp = Date.now();
      
      // 写真アップロード
      const imgName = `photo_${timestamp}.jpg`;
      const { error: imgErr } = await supabase.storage.from('photos').upload(imgName, imageFile);
      if (imgErr) throw imgErr;
      const photoUrl = `${supabaseUrl}/storage/v1/object/public/photos/${imgName}`;

      // 音声アップロード（ある場合のみ）
      let audioUrl = "";
      if (audioBlob) {
        const audName = `audio_${timestamp}.webm`;
        const { error: audErr } = await supabase.storage.from('photos').upload(audName, audioBlob);
        if (audErr) throw audErr;
        audioUrl = `${supabaseUrl}/storage/v1/object/public/photos/${audName}`;
      }

      // DB登録
      const { error: dbErr } = await supabase.from('posts').insert([{
        user_id: userId, group_name: uploadGroup, theme: comment, photo_url: photoUrl, audio_url: audioUrl
      }]);
      if (dbErr) throw dbErr;

      alert('投稿完了！');
      setComment(''); setImageFile(null); setAudioBlob(null); setScreen('gallery');
    } catch (e: any) {
      alert("送信エラー: " + e.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', minHeight: '100vh', background: '#f5f5f5', fontFamily: 'sans-serif' }}>
      <header style={{ background: '#000', color: '#fff', padding: '15px', textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '20px' }}>PhotoVox</h1>
      </header>

      <main style={{ padding: '20px' }}>
        {!role ? (
          <div style={{ background: '#fff', padding: '30px', borderRadius: '15px' }}>
            <h2 style={{ textAlign: 'center' }}>ログイン</h2>
            <input type="text" placeholder="学籍番号を入力" value={userId} onChange={e => setUserId(e.target.value)} style={{ width: '100%', padding: '15px', marginBottom: '15px', boxSizing: 'border-box' }} />
            <button onClick={handleLogin} style={{ width: '100%', padding: '15px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>ログイン</button>
          </div>
        ) : screen === 'home' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {role === 'student' && <button onClick={() => setScreen('upload')} style={{ padding: '40px', fontSize: '20px', background: '#000', color: '#fff', borderRadius: '15px' }}>📷 調査報告を投稿</button>}
            <button onClick={() => setScreen('gallery')} style={{ padding: '40px', fontSize: '20px', background: '#fff', border: '2px solid #000', borderRadius: '15px' }}>📂 ギャラリーを見る</button>
            <button onClick={() => location.reload()} style={{ marginTop: '20px' }}>ログアウト</button>
          </div>
        ) : screen === 'upload' ? (
          <div style={{ background: '#fff', padding: '20px', borderRadius: '15px' }}>
            <h3 style={{ marginTop: 0 }}>新規投稿</h3>
            <select value={uploadGroup} onChange={e => setUploadGroup(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '15px' }}>
              <option value="">担当班を選択</option>
              {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} style={{ marginBottom: '20px' }} />
            
            <div style={{ marginBottom: '20px', background: '#eee', padding: '15px', borderRadius: '10px' }}>
              {!isRecording ? (
                <button onClick={startRecording} style={{ background: '#0070f3', color: '#fff', padding: '10px 20px', border: 'none', borderRadius: '5px' }}>🎤 録音開始</button>
              ) : (
                <button onClick={stopRecording} style={{ background: 'red', color: '#fff', padding: '10px 20px', border: 'none', borderRadius: '5px' }}>🛑 停止</button>
              )}
              {audioBlob && <span style={{ marginLeft: '10px' }}>✅ 録音済</span>}
            </div>

            <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="気づいた点" style={{ width: '100%', height: '80px', marginBottom: '20px', padding: '10px' }} />
            <button onClick={handleUpload} disabled={uploading} style={{ width: '100%', padding: '20px', background: uploading ? '#999' : '#000', color: '#fff', borderRadius: '10px' }}>
              {uploading ? '送信中...' : '投稿を確定'}
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2>ギャラリー</h2>
              <button onClick={() => setScreen('home')}>戻る</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              {posts.map(p => (
                <div key={p.id} style={{ background: '#fff', borderRadius: '10px', border: '1px solid #ddd', overflow: 'hidden' }}>
                  <img src={p.photo_url} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover' }} />
                  <div style={{ padding: '10px', fontSize: '11px' }}>
                    <strong>{p.group_name}</strong><br/>{p.theme}
                    {p.audio_url && <audio src={p.audio_url} controls style={{ width: '100%', height: '30px', marginTop: '5px' }} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}