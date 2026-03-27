'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

// ★ ここに先生のURLとKeyを貼り付けてください
const supabaseUrl = 'https://xxxxxxxxxxxxxxxxxxxx.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'

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

  // ログイン処理
  const handleLogin = () => {
    const id = userId.trim().replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    if (!id) return alert('学籍番号を入力してください');

    let userRole: 'student' | 'viewer' | 'teacher' = 'student';
    if (id === '0526') {
      userRole = 'teacher';
    } else if (GROUPS.some(g => g.toLowerCase() === id.toLowerCase())) {
      userRole = 'viewer';
      const matched = GROUPS.find(g => g.toLowerCase() === id.toLowerCase()) || id;
      setUserId(matched);
    } else {
      setUserId(id);
    }
    setRole(userRole);
  }

  // データ取得
  const loadPosts = async () => {
    try {
      const { data, error } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
      if (error) throw error;

      if (role === 'teacher') {
        setPosts(data || []);
      } else if (role === 'viewer') {
        setPosts(data?.filter(p => p.group_name === userId) || []);
      } else {
        setPosts(data?.filter(p => p.user_id === userId) || []);
      }
    } catch (e: any) {
      alert("データ取得エラー: " + e.message);
    }
  }

  useEffect(() => {
    if (screen === 'gallery' && role) loadPosts();
  }, [screen, role]);

  // 録音処理
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => setAudioBlob(new Blob(chunks, { type: 'audio/m4a' }));
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (e) {
      alert("マイクの使用を許可してください");
    }
  }
  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }

  // アップロード処理
  const handleUpload = async () => {
    if (!uploadGroup || !imageFile) return alert('班と写真を選択してください');
    setUploading(true);
    try {
      const ts = Date.now();
      const imgName = `photo_${ts}.jpg`;
      const { error: imgErr } = await supabase.storage.from('photos').upload(imgName, imageFile);
      if (imgErr) throw imgErr;

      const photoUrl = `${supabaseUrl}/storage/v1/object/public/photos/${imgName}`;

      let audioUrl = "";
      if (audioBlob) {
        const audName = `audio_${ts}.m4a`;
        const { error: audErr } = await supabase.storage.from('photos').upload(audName, audioBlob);
        if (audErr) throw audErr;
        audioUrl = `${supabaseUrl}/storage/v1/object/public/photos/${audName}`;
      }

      const { error: dbErr } = await supabase.from('posts').insert([{
        user_id: userId,
        group_name: uploadGroup,
        theme: comment,
        photo_url: photoUrl,
        audio_url: audioUrl
      }]);
      if (dbErr) throw dbErr;

      alert('投稿が完了しました！');
      setComment('');
      setImageFile(null);
      setAudioBlob(null);
      setScreen('gallery');
    } catch (e: any) {
      alert("送信エラー: " + e.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', minHeight: '100vh', background: '#f8f9fa', fontFamily: 'sans-serif' }}>
      <header style={{ background: '#000', color: '#fff', padding: '15px', textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '20px' }}>PhotoVox</h1>
      </header>

      <main style={{ padding: '20px' }}>
        {!role ? (
          <div style={{ background: '#fff', padding: '30px', borderRadius: '15px', border: '1px solid #ddd' }}>
            <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>ログイン</h2>
            <input type="text" placeholder="学籍番号を入力してください" value={userId} onChange={e => setUserId(e.target.value)} style={{ width: '100%', padding: '15px', fontSize: '18px', marginBottom: '15px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #ccc' }} />
            <button onClick={handleLogin} style={{ width: '100%', padding: '15px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '18px' }}>ログイン</button>
          </div>
        ) : screen === 'home' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '40px' }}>
            {role === 'student' && (
              <button onClick={() => setScreen('upload')} style={{ padding: '40px', fontSize: '20px', background: '#000', color: '#fff', borderRadius: '15px', border: 'none', fontWeight: 'bold' }}>📷 調査結果を報告する</button>
            )}
            <button onClick={() => setScreen('gallery')} style={{ padding: '40px', fontSize: '20px', background: '#fff', border: '3px solid #000', borderRadius: '15px', fontWeight: 'bold' }}>📂 ギャラリーを見る</button>
            <button onClick={() => location.reload()} style={{ marginTop: '20px', background: 'none', border: 'none', textDecoration: 'underline', color: '#666' }}>ログアウト</button>
          </div>
        ) : screen === 'upload' ? (
          <div style={{ background: '#fff', padding: '20px', borderRadius: '15px', border: '1px solid #ddd' }}>
            <h3 style={{ marginTop: 0 }}>新規投稿</h3>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>担当の班：</label>
            <select value={uploadGroup} onChange={e => setUploadGroup(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '20px', borderRadius: '5px' }}>
              <option value="">選択してください</option>
              {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>写真を選択：</label>
            <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} style={{ marginBottom: '20px', width: '100%' }} />
            
            <div style={{ marginBottom: '20px', background: '#f0f0f0', padding: '15px', borderRadius: '10px' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>音声メモ：</label>
              {!isRecording ? (
                <button onClick={startRecording} style={{ background: '#0070f3', color: '#fff', padding: '10px 20px', border: 'none', borderRadius: '5px' }}>🎤 録音開始</button>
              ) : (
                <button onClick={stopRecording} style={{ background: 'red', color: '#fff', padding: '10px 20px', border: 'none', borderRadius: '5px' }}>🛑 録音を停止</button>
              )}
              {audioBlob && <span style={{ marginLeft: '10px', color: 'green' }}>✅ 録音完了</span>}
            </div>

            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>気づいた点（メモ）：</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="内容を入力してください" style={{ width: '100%', height: '80px', marginBottom: '20px', padding: '10px', boxSizing: 'border-box', borderRadius: '5px', border: '1px solid #ccc' }} />
            
            <button onClick={handleUpload} disabled={uploading} style={{ width: '100%', padding: '20px', background: uploading ? '#ccc' : '#000', color: '#fff', borderRadius: '10px', fontSize: '18px', border: 'none', fontWeight: 'bold' }}>
              {uploading ? '送信中...' : '投稿を確定する'}
            </button>
            <p onClick={() => setScreen('home')} style={{ textAlign: 'center', marginTop: '15px', cursor: 'pointer', textDecoration: 'underline', color: '#666' }}>キャンセルして戻る</p>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>ギャラリー</h2>
              <button onClick={() => setScreen('home')} style={{ padding: '8px 15px', borderRadius: '5px', border: '1px solid #000', background: '#fff' }}>戻る</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              {posts.map(p => (
                <div key={p.id} style={{ background: '#fff', borderRadius: '10px', border: '1px solid #ddd', overflow: 'hidden', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                  <img src={p.photo_url} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover' }} alt="post" />
                  <div style={{ padding: '10px', fontSize: '11px' }}>
                    <strong style={{ fontSize: '13px' }}>{p.group_name}</strong> <span style={{ color: '#888' }}>({p.user_id})</span>
                    <p style={{ margin: '8px 0', fontSize: '12px', lineHeight: '1.4' }}>{p.theme}</p>
                    {p.audio_url && <audio src={p.audio_url} controls style={{ width: '100%', height: '30px', marginTop: '5px' }} />}
                  </div>
                </div>
              ))}
            </div>
            {posts.length === 0 && <p style={{ textAlign: 'center', marginTop: '50px', color: '#999' }}>まだ投稿がありません</p>}
          </div>
        )}
      </main>
    </div>
  );
}