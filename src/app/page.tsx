'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://zlpcaxrjwlbrisyurfdr.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpscGNheHJqd2xicmlzeXVyZmRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTkxNTcsImV4cCI6MjA5MDA5NTE1N30.BT4yx6ipKUvM-nieU0d0ofbiUqUE7hY4Q3x1EYI_Bs8'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const GROUPS = ['GroupA','GroupB','GroupC','GroupD','GroupE','GroupF','GroupG','GroupH']

export default function Home() {
  const [role, setRole] = useState<'student' | 'teacher' | null>(null)
  const [userId, setUserId] = useState('')
  const [uploadGroup, setUploadGroup] = useState('')
  const [screen, setScreen] = useState<'home' | 'upload' | 'gallery'>('home')
  const [posts, setPosts] = useState<any[]>([])
  const [comment, setComment] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loginId, setLoginId] = useState('')
  const [loginGroup, setLoginGroup] = useState('')

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/heic2any@0.0.3/dist/heic2any.min.js";
    script.async = true; document.body.appendChild(script);

    const savedId = localStorage.getItem('photovox_id');
    const savedGroup = localStorage.getItem('photovox_group');
    if (savedId) { 
      setUserId(savedId); 
      setRole(savedId === '0526T' ? 'teacher' : 'student'); 
      if (savedGroup) setUploadGroup(savedGroup); 
    }
  }, []);

  const getFullUrl = (rawPath: string) => {
    if (!rawPath) return "";
    const fileName = rawPath.includes('/') ? rawPath.split('/').pop() : rawPath;
    return `${SUPABASE_URL}/storage/v1/object/public/photos/${fileName}?t=${Date.now()}`;
  };

  const fetchPosts = async () => {
    setStatusMsg('読み込み中...');
    try {
      let query = supabase.from('posts').select('*');
      if (role !== 'teacher') {
        query = query.eq('user_id', userId);
      }
      const { data, error } = await query.order('id', { ascending: false });
      if (error) throw error;
      setPosts(data || []);
      setStatusMsg(data?.length === 0 ? 'データがありません' : '');
    } catch (err) {
      setStatusMsg('エラーが発生しました');
    }
  };

  useEffect(() => { if (screen === 'gallery') fetchPosts(); }, [screen, role, userId]);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    mediaRecorderRef.current = mr;
    const chunks: Blob[] = [];
    mr.ondataavailable = e => chunks.push(e.data);
    mr.onstop = () => setAudioBlob(new Blob(chunks, { type: 'audio/webm' }));
    mr.start(); setIsRecording(true);
  };
  const stopRecording = () => { mediaRecorderRef.current?.stop(); setIsRecording(false); };

  const handleUpload = async () => {
    if (!uploadGroup || !imageFile) return alert('写真は必須です');
    setUploading(true); setStatusMsg('送信中...');
    try {
      let activeFile = imageFile;
      if (imageFile.name.toLowerCase().endsWith('.heic')) {
        const blob = await (window as any).heic2any({ blob: imageFile, toType: "image/jpeg", quality: 0.8 });
        activeFile = new File([Array.isArray(blob) ? blob[0] : blob], imageFile.name.replace(/\.heic/i, '.jpg'), { type: "image/jpeg" });
      }
      const ts = Date.now();
      const photoName = `img_${ts}.jpg`;
      await supabase.storage.from('photos').upload(photoName, activeFile);

      let audioName = "";
      if (audioBlob) {
        audioName = `aud_${ts}.webm`;
        await supabase.storage.from('photos').upload(audioName, audioBlob);
      }

      const { error } = await supabase.from('posts').insert([{
        user_id: userId, group_name: uploadGroup, theme: comment,
        photo_url: photoName, audio_url: audioName
      }]);
      if (error) throw error;

      alert('送信完了！');
      setComment(''); setImageFile(null); setImagePreview(null); setAudioBlob(null); setScreen('gallery');
    } catch (e: any) { alert("送信エラー"); } finally { setUploading(false); setStatusMsg(''); }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', minHeight: '100vh', background: '#f8fafc', fontFamily: 'sans-serif' }}>
      <header style={{ background: '#0070f3', padding: '15px', color: '#fff', textAlign:'center', position:'sticky', top:0, zIndex:10 }}>
        <h1 onClick={() => setScreen('home')} style={{ margin: 0, fontSize: '20px', cursor:'pointer' }}>PhotoVox</h1>
        {role && <div style={{fontSize: '11px'}}>{userId} / {uploadGroup} ({role === 'teacher' ? '教員用' : '個人用'})</div>}
      </header>

      <main style={{ padding: '20px' }}>
        {!role ? (
          <div style={{ background: '#fff', padding: '30px', borderRadius: '25px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
            <h2 style={{textAlign:'center', marginBottom: '25px'}}>調査ログイン</h2>
            
            <div style={{marginBottom: '15px'}}>
              <label style={{fontSize: '12px', color: '#666', marginLeft: '5px'}}>ID（氏名 または 班名）</label>
              <input 
                type="text" placeholder="例：B26C001秋田太郎" value={loginId} 
                onChange={e => {
                  const val = e.target.value;
                  setLoginId(val);
                  // 【教員ルート】0526Tで即ログイン
                  if (val === '0526T') {
                    setUserId('管理者'); setUploadGroup('教員'); setRole('teacher');
                    localStorage.setItem('photovox_id', '0526T'); localStorage.setItem('photovox_group', '教員');
                  }
                }} 
                style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '2px solid #edf2f7', boxSizing:'border-box', fontSize: '16px' }} 
              />
            </div>

            {/* 0526T以外かつ入力がある場合のみ追加項目を表示 */}
            {loginId !== '0526T' && loginId.length > 0 && (
              <>
                {loginId.includes('Group') ? (
                  /* --- パターンB：班ログイン (IDに"Group"を含む場合) --- */
                  <div style={{marginBottom: '20px'}}>
                    <label style={{fontSize: '12px', color: '#666', marginLeft: '5px'}}>パスワード（0519）</label>
                    <input 
                      type="password" placeholder="パスワードを入力" 
                      onChange={e => {
                        const pass = e.target.value;
                        if (pass === '0519') {
                          setUserId(loginId); setUploadGroup(loginId); setRole('student');
                          localStorage.setItem('photovox_id', loginId); localStorage.setItem('photovox_group', loginId);
                        }
                      }}
                      style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '2px solid #edf2f7', boxSizing:'border-box', fontSize: '16px' }}
                    />
                  </div>
                ) : (
                  /* --- パターンC：個人ログイン (それ以外) --- */
                  <>
                    <div style={{marginBottom: '15px'}}>
                      <label style={{fontSize: '12px', color: '#666', marginLeft: '5px'}}>担当班を選択</label>
                      <select 
                        value={loginGroup} onChange={e => setLoginGroup(e.target.value)} 
                        style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '2px solid #edf2f7', background: '#fff', fontSize: '16px' }}
                      >
                        <option value="">-- 班を選択 --</option>
                        {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <button 
                      onClick={() => {
                        if(!loginGroup) return alert('班を選択してください');
                        setUserId(loginId); setUploadGroup(loginGroup); setRole('student');
                        localStorage.setItem('photovox_id', loginId); localStorage.setItem('photovox_group', loginGroup);
                      }}
                      style={{ width: '100%', padding: '18px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: '15px', fontWeight: 'bold' }}
                    >
                      ログイン
                    </button>
                  </>
                )}
              </>
            )}
            <p style={{fontSize: '11px', color: '#94a3b8', textAlign: 'center', marginTop: '15px'}}>
              教員：0526Tを入力 / 班：班名+パスワード / 個人：氏名+班選択
            </p>
          </div>
        ) : screen === 'home' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <button onClick={() => setScreen('upload')} style={{ padding: '70px 20px', fontSize: '22px', borderRadius: '25px', background: '#0070f3', color: '#fff', border:'none', fontWeight:'bold' }}>📸 調査報告を投稿</button>
            <button onClick={() => setScreen('gallery')} style={{ padding: '70px 20px', fontSize: '22px', borderRadius: '25px', background: '#fff', color: '#333', border:'2px solid #e2e8f0', fontWeight:'bold' }}>📂 データを閲覧</button>
            <button onClick={() => {localStorage.clear(); window.location.reload();}} style={{marginTop:'20px', color:'#999', background:'none', border:'none'}}>ログアウト</button>
          </div>
        ) : screen === 'upload' ? (
          <div style={{ background: '#fff', padding: '24px', borderRadius: '25px' }}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
              <h3>新規報告 ({uploadGroup})</h3>
              <button onClick={() => setScreen('home')} style={{border:'none', background:'#eee', padding:'5px 15px', borderRadius:'10px'}}>戻る</button>
            </div>
            <div onClick={() => fileInputRef.current?.click()} style={{ background: '#f0f7ff', padding: '30px', textAlign: 'center', border: '2px dashed #0070f3', borderRadius: '20px', marginBottom: '20px' }}>
              {imagePreview ? <img src={imagePreview} style={{ maxWidth: '100%', maxHeight: '250px', borderRadius:'10px' }} /> : '📷 写真を選択'}
              <input type="file" accept="image/*,.heic" ref={fileInputRef} onChange={e => {
                const f = e.target.files?.[0];
                if(f) { setImageFile(f); const r = new FileReader(); r.onloadend = () => setImagePreview(r.result as string); r.readAsDataURL(f); }
              }} style={{ display: 'none' }} />
            </div>
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
              {!audioBlob ? (
                <button onClick={isRecording ? stopRecording : startRecording} style={{ width: '100%', padding: '15px', borderRadius: '15px', background: isRecording ? '#e74c3c' : '#f1f5f9', color: isRecording ? '#fff' : '#333', border: 'none' }}>
                  {isRecording ? '🛑 録音を停止' : '🎙️ 音声メモを録音'}
                </button>
              ) : (
                <div style={{ background: '#f1f5f9', padding: '10px', borderRadius: '15px' }}>
                  <audio src={URL.createObjectURL(audioBlob)} controls style={{ width: '100%' }} />
                  <button onClick={() => setAudioBlob(null)} style={{ marginTop: '5px', fontSize: '12px', color: '#e74c3c', background: 'none', border: 'none' }}>録音をやり直す</button>
                </div>
              )}
            </div>
            <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="調査メモ" style={{ width: '100%', height: '100px', marginBottom: '20px', padding: '15px', boxSizing:'border-box', borderRadius:'15px', border:'1px solid #ddd' }} />
            <button onClick={handleUpload} disabled={uploading} style={{ width: '100%', padding: '20px', background: '#10b981', color: '#fff', borderRadius: '15px', fontWeight: 'bold', border:'none' }}>
              {uploading ? '送信中...' : '🚀 報告を送信'}
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems:'center' }}>
              <h2 style={{ margin: 0, fontSize: '20px' }}>{role === 'teacher' ? '全体一覧' : '自分の投稿'}</h2>
              <button onClick={() => setScreen('home')} style={{padding:'8px 15px', borderRadius:'10px', background:'#fff', border:'1px solid #ddd'}}>戻る</button>
            </div>
            {statusMsg && <div style={{textAlign:'center', padding:'20px', color:'#0070f3'}}>{statusMsg}</div>}
            <div style={{ display: 'grid', gap: '20px' }}>
              {posts.map(p => (
                <div key={p.id} style={{ background: '#fff', borderRadius: '25px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                  <img src={getFullUrl(p.photo_url)} style={{ width: '100%', minHeight: '200px', objectFit: 'cover' }} />
                  <div style={{ padding: '20px' }}>
                    <div style={{ fontWeight: 'bold', color: '#0070f3', marginBottom:'10px' }}>{p.group_name} <span style={{color:'#999', fontSize:'12px', fontWeight:'normal'}}>{p.user_id}</span></div>
                    <p style={{ marginBottom: '10px' }}>{p.theme}</p>
                    {p.audio_url && <audio src={getFullUrl(p.audio_url)} controls style={{ width: '100%', height: '35px' }} />}
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