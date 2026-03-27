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
  const [screen, setScreen] = useState<'home'|'upload'|'gallery'>('home')
  const [posts, setPosts] = useState<any[]>([])
  const [uploadGroup, setUploadGroup] = useState('')
  const [comment, setComment] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  
  // 音声録音用ステート
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  // 1. ログイン処理（全角→半角変換、教員・班・学生の判定）
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

  // 2. データ取得（フィルタリングを論理的に整理）
  const loadPosts = async () => {
    const { data, error } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
    if (error) {
      alert("データ取得失敗: " + error.message);
      return;
    }
    // アプリ側でフィルタをかける（これが最もエラーが起きにくい）
    if (role === 'teacher') setPosts(data || []);
    else if (role === 'viewer') setPosts(data?.filter(p => p.group_name === userId) || []);
    else setPosts(data?.filter(p => p.user_id === userId) || []);
  }

  useEffect(() => {
    if (screen === 'gallery' && role) loadPosts();
  }, [screen, role]);

  // 3. 録音機能
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
    } catch (e) { alert("マイクの許可が必要です"); }
  }
  const stopRecording = () => { mediaRecorderRef.current?.stop(); setIsRecording(false); }

  // 4. アップロード処理（写真 + 音声 + DB登録）
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

      // 音声アップロード（任意）
      let audioUrl = "";
      if (audioBlob) {
        const audName = `audio_${timestamp}.m4a`;
        const { error: audErr } = await supabase.storage.from('photos').upload(audName, audioBlob);
        if (audErr) throw audErr;
        audioUrl = `${supabaseUrl}/storage/v1/object/public/photos/${audName}`;
      }

      // DB登録
      const { error: dbErr } = await supabase.from('posts').insert([{
        user_id: userId,
        group_name: uploadGroup,
        theme: comment,
        photo_url: photoUrl,
        audio_url: audioUrl
      }]);
      if (dbErr) throw dbErr;

      alert('投稿が完了しました！');
      setScreen('gallery');
    } catch (e: any) {
      alert("エラーが発生しました: " + e.message);
    } finally {
      setUploading(false);
    }
  }

  // 画面表示
  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', minHeight: '100vh', background: '#f8f9fa', fontFamily: 'sans-serif' }}>
      <header style={{ background: '#000', color: '#fff', padding: '15px', textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '20px' }}>PhotoVox</h1>
      </header>

      <main style={{ padding: '20px' }}>
        {!role ? (
          <div style={{ background: '#fff', padding: '30px', borderRadius: '15px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <h2 style={{ textAlign: 'center' }}>ログイン</h2>
            <input type="text" placeholder="学籍番号を入力" value={userId} onChange={e => setUserId(e.target.value)} style={{ width: '100%', padding: '15px', fontSize: '18px', marginBottom: '15px', border: '1px solid #ddd', borderRadius: '8px' }} />
            <button onClick={handleLogin} style={{ width: '100%', padding: '15px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>ログイン</button>
          </div>
        ) : screen === 'home' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {role === 'student' && <button onClick={() => setScreen('upload')} style={{ padding: '40px', fontSize: '20px', background: '#000', color: '#fff', borderRadius: '15px' }}>📷 調査結果を報告する</button>}
            <button onClick={() => setScreen('gallery')} style={{ padding: '40px', fontSize: '20px', background: '#fff', border: '2px solid #000', borderRadius: '15px' }}>📂 ギャラリーを見る</button>
            <button onClick={() => location.reload()} style={{ marginTop: '20px' }}>ログアウト</button>
          </div>
        ) : screen === 'upload' ? (
          <div style={{ background: '#fff', padding: '20px', borderRadius: '15px' }}>
            <h3>新規投稿</h3>
            <label>担当の班：</label>
            <select value={uploadGroup} onChange={e => setUploadGroup(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '20px' }}>
              <option value="">選択してください</option>
              {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            
            <label>写真：</label>
            <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} style={{ marginBottom: '20px' }} />
            
            <div style={{ marginBottom: '20px', background: '#f0f0f0', padding: '15px', borderRadius: '10px' }}>
              <label style={{ display: 'block', marginBottom: '10px' }}>音声メモ：</label>
              {!isRecording ? 
                <button onClick={startRecording} style={{ background: '#0070f3', color: '#fff', padding: '10px 20px', border: 'none', borderRadius: '5px' }}>🎤 録音開始</button> : 
                <button onClick={stopRecording} style={{ background: 'red', color: '#fff', padding: '10px 20px', border: 'none', borderRadius: '5px' }}>🛑 停止</button>
              }
              {audioBlob && <span style={{ marginLeft: '10px' }}>✅ 録音完了</span>}
            </div>

            <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="気づいたことをメモ" style={{ width: '100%', height: '80px', marginBottom: '20px', padding: '10px' }} />
            
            <button onClick={handleUpload} disabled={uploading} style={{ width: '100%', padding: '20px', background: uploading ? '#ccc' : '#000', color: '#fff', borderRadius: '10px', fontSize: '18px' }}>
              {uploading ? '送信中...' : '投稿を確定する'}
            </button>
            <p onClick={() => setScreen('home')} style={{ textAlign: 'center', marginTop: '15px', cursor: 'pointer', textDecoration: 'underline' }}>キャンセルして戻る</p>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>{role === 'teacher' ? '管理：全投稿' : role === 'viewer' ? `${userId} の投稿` : '自分の投稿'}</h2>
              <button onClick={() => setScreen('home')} style={{ padding: '8px 15px' }}>戻る</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              {posts.map(p => (
                <div key={p.id} style={{ background: '#fff', borderRadius: '10px', border: '1px solid #ddd', overflow: 'hidden' }}>
                  <img src={p.photo_url} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover' }} />
                  <div style={{ padding: '10px', fontSize: '11px' }}>
                    <strong>{p.group_name}</strong> ({p.user_id})<br/>
                    <p style={{ margin: '5px 0', fontSize: '13px' }}>{p.theme}</p>
                    {p.audio_url && <audio src={p.audio_url} controls style={{ width: '100%', height: '30px' }} />}
                  </div>
                </div>
              ))}
            </div>
            {posts.length === 0 && <p style={{ textAlign: 'center', marginTop: '50px', color: '#999' }}></p>