'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

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

  const handleLogin = () => {
    const id = userId.trim().replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    if (!id) return alert('学籍番号を入力してください');

    let userRole: 'student' | 'viewer' | 'teacher' = (id === '0526') ? 'teacher' : (GROUPS.some(g => g.toLowerCase() === id.toLowerCase()) ? 'viewer' : 'student');
    setUserId(userRole === 'viewer' ? GROUPS.find(g => g.toLowerCase() === id.toLowerCase()) || id : id);
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
      alert("読み込みエラー: Supabaseのテーブルに group_name と theme の列があるか確認してください");
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
    } catch (e) { alert("マイクが許可されていません"); }
  }
  const stopRecording = () => { mediaRecorderRef.current?.stop(); setIsRecording(false); }

  const handleUpload = async () => {
    if (!uploadGroup || !imageFile) return alert('班と写真を選択してください');
    setUploading(true);
    try {
      const ts = Date.now();
      const imgName = `photo_${ts}.jpg`;
      await supabase.storage.from('photos').upload(imgName, imageFile);
      const photoUrl = `${supabaseUrl}/storage/v1/object/public/photos/${imgName}`;

      let audioUrl = "";
      if (audioBlob) {
        const audName = `audio_${ts}.webm`;
        await supabase.storage.from('photos').upload(audName, audioBlob);
        audioUrl = `${supabaseUrl}/storage/v1/object/public/photos/${audName}`;
      }

      const { error } = await supabase.from('posts').insert([{
        user_id: userId,
        group_name: uploadGroup,
        theme: comment,
        photo_url: photoUrl,
        audio_url: audioUrl
      }]);
      if (error) throw error;

      alert('投稿完了！');
      setComment(''); setImageFile(null); setAudioBlob(null); setScreen('gallery');
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
            <h2 style={{ textAlign: 'center' }}>ログイン</h2>
            <input type="text" placeholder="学籍番号を入力" value={userId} onChange={e => setUserId(e.target.value)} style={{ width: '100%', padding: '15px', fontSize: '18px', marginBottom: '15px', boxSizing: 'border-box' }} />
            <button onClick={handleLogin} style={{ width: '100%', padding: '15px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>ログイン</button>
          </div>
        ) : screen === 'home' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '40px' }}>
            {role === 'student' && <button onClick={() => setScreen('upload')} style={{ padding: '40px', fontSize: '20px', background: '#000', color: '#fff', borderRadius: '15px' }}>📷 調査報告を投稿</button>}
            <button onClick={() => setScreen('gallery')} style={{ padding: '40px', fontSize: '20px', background: '#fff', border: '3px solid #000', borderRadius: '15px' }}>📂 ギャラリーを見る</button>
            <button onClick={() => location.reload()} style={{ marginTop: '20px' }}>ログアウト</button>
          </div>
        ) : screen === 'upload' ? (
          <div style={{ background: '#fff', padding: '20px', borderRadius: '15px', border: '1px solid #ddd' }}>
            <h3 style={{ marginTop: 0 }}>新規投稿</h3>
            <select value={uploadGroup} onChange={e => setUploadGroup(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '15px' }}>
              <option value="">担当班を選択</option>
              {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} style={{ marginBottom: '20px' }} />
            <div style={{ marginBottom: '20px', background: '#eee', padding: '15px', borderRadius: '10px' }}>
              {!isRecording ? <button onClick={startRecording}>🎤 録音開始</button> : <button onClick={stopRecording} style={{ color: 'red' }}>🛑 停止</button>}
              {audioBlob && <span style={{ marginLeft: '10px' }}>✅ 録音済</span>}
            </div>
            <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="気づいた点（メモ）" style={{ width: '100%', height: '80px', marginBottom: '20px', padding: '10px', boxSizing: 'border-box' }} />
            <button onClick={handleUpload} disabled={uploading} style={{ width: '100%', padding: '20px', background: uploading ? '#999' : '#000', color: '#fff', borderRadius: '10px', fontWeight: 'bold' }}>
              {uploading ? '送信中...' : '投稿を確定'}
            </button>
            <p onClick={() => setScreen('home')} style={{ textAlign: 'center', marginTop: '15px', cursor: 'pointer', textDecoration: 'underline' }}>戻る</p>
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
                    <strong>{p.group_name}</strong> ({p.user_id})<br/>
                    <p style={{ margin: '5px 0', fontSize: '12px' }}>{p.theme}</p>
                    {p.audio_url && <audio src={p.audio_url} controls style={{ width: '100%', height: '30px', marginTop: '5px' }} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}