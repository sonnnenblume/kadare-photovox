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
  const [extraNote, setExtraNote] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recognitionRef = useRef<any>(null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bulkUploadRef = useRef<HTMLInputElement>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingText, setEditingText] = useState('')
  const [transcribingId, setTranscribingId] = useState<number | null>(null)
  const [groupByGroup, setGroupByGroup] = useState(false)
  const [filterGroup, setFilterGroup] = useState('all')
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'user_asc' | 'user_desc'>('date_desc')
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
    return `${SUPABASE_URL}/storage/v1/object/public/photos/${fileName}`;
  };

  const getThumbUrl = (rawPath: string) => {
    if (!rawPath) return "";
    const fileName = rawPath.includes('/') ? rawPath.split('/').pop() : rawPath;
    return `${SUPABASE_URL}/storage/v1/render/image/public/photos/${fileName}?width=800&quality=70`;
  };

  const fetchPosts = async () => {
    setStatusMsg('読み込み中...');
    try {
      let query = supabase.from('posts').select('*');

      // ★閲覧制限ロジックの追加
      if (role === 'teacher') {
        // 教員は全件取得（フィルタなし）
      } else if (userId.startsWith('Group')) {
        // 班IDでログインした場合は、その班の全データを表示
        query = query.eq('group_name', userId);
      } else {
        // 学籍番号（個人）でログインした場合は、自分の投稿のみ表示
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

  const handleBulkDownload = () => {
    const headers = ['ID', 'グループ', 'ユーザーID', 'テキスト', '写真URL'];
    const rows = posts.map(p => [
      p.id,
      p.group_name,
      p.user_id,
      `"${(p.theme || '').replace(/"/g, '""')}"`,
      getFullUrl(p.photo_url)
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `photovox_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split('\n').slice(1);
    const records = lines.filter(l => l.trim()).map(line => {
      const cols = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
      return { group_name: cols[0], user_id: cols[1], theme: cols[2], photo_url: '', audio_url: '' };
    });
    if (records.length === 0) return alert('データがありません');
    const { error } = await supabase.from('posts').insert(records);
    if (error) { alert('アップロードに失敗しました'); return; }
    alert(`${records.length}件をインポートしました`);
    e.target.value = '';
    fetchPosts();
  };

  const handleTranscribe = async (postId: number, audioPath: string) => {
    setTranscribingId(postId)
    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioPath }),
      })
      const { text, error } = await res.json()
      if (error) throw new Error(error as string)
      const { error: dbError } = await supabase.from('posts').update({ theme: text }).eq('id', postId)
      if (dbError) throw dbError
      fetchPosts()
    } catch (e: any) {
      alert(`文字起こしに失敗しました\n${e?.message ?? ''}`)
    } finally {
      setTranscribingId(null)
    }
  }

  const handleEdit = async (postId: number) => {
    const { error } = await supabase.from('posts').update({ theme: editingText }).eq('id', postId);
    if (error) { alert('更新に失敗しました'); return; }
    setEditingId(null);
    fetchPosts();
  };

  const handleDelete = async (postId: number, photoPath: string, audioPath: string) => {
    if (!confirm('この投稿を削除してもよろしいですか？')) return;
    try {
      const { error } = await supabase.from('posts').delete().eq('id', postId);
      if (error) throw error;
      if (photoPath) await supabase.storage.from('photos').remove([photoPath]);
      if (audioPath) await supabase.storage.from('photos').remove([audioPath]);
      alert('削除しました');
      fetchPosts();
    } catch (e) { alert('削除に失敗しました'); }
  };

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    mediaRecorderRef.current = mr;
    const chunks: Blob[] = [];
    mr.ondataavailable = e => chunks.push(e.data);
    mr.onstop = () => {
      const mimeType = mr.mimeType || 'audio/webm';
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      setAudioBlob(blob);
      setAudioUrl(url);
    };
    mr.start(); setIsRecording(true);

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ja-JP';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event: any) => {
        let fullText = '';
        for (let i = 0; i < event.results.length; i++) {
          fullText += event.results[i][0].transcript;
        }
        setComment(fullText);
      };
      recognition.onend = () => setIsTranscribing(false);
      recognition.onerror = (event: any) => {
        if (event.error !== 'aborted' && event.error !== 'no-speech') {
          console.error('Speech recognition error:', event.error);
        }
        setIsTranscribing(false);
      };
      recognitionRef.current = recognition;
      recognition.start();
      setIsTranscribing(true);
    }
  };
  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    recognitionRef.current?.stop();
  };

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
      const theme = [comment, extraNote].filter(s => s.trim()).join('\n【追加記入】\n');
      const { error } = await supabase.from('posts').insert([{
        user_id: userId, group_name: uploadGroup, theme,
        photo_url: photoName, audio_url: audioName
      }]);
      if (error) throw error;
      alert('送信完了！');
      setComment(''); setExtraNote(''); setImageFile(null); setImagePreview(null); setAudioBlob(null); if (audioUrl) URL.revokeObjectURL(audioUrl); setAudioUrl(null); setScreen('gallery');
    } catch (e: any) { alert("送信エラー"); } finally { setUploading(false); setStatusMsg(''); }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', minHeight: '100vh', background: '#f8fafc', fontFamily: 'sans-serif' }}>
      <header style={{ background: '#0070f3', padding: '15px', color: '#fff', textAlign:'center', position:'sticky', top:0, zIndex:10 }}>
        <h1 onClick={() => setScreen('home')} style={{ margin: 0, fontSize: '20px', cursor:'pointer' }}>PhotoVox</h1>
        {role && <div style={{fontSize: '11px'}}>{userId} / {uploadGroup} ({role === 'teacher' ? '教員' : '学生'})</div>}
      </header>

      <main style={{ padding: '20px' }}>
        {!role ? (
          /* ログイン画面 */
          <div style={{ background: '#fff', padding: '30px', borderRadius: '25px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
            <h2 style={{textAlign:'center', marginBottom: '25px'}}>調査ログイン</h2>
            <div style={{marginBottom: '15px'}}>
              <label style={{fontSize: '12px', color: '#666', marginLeft: '5px'}}>学籍番号・氏名</label>
              <input 
                type="text" placeholder="例：B26C001秋田太郎" value={loginId} 
                onChange={e => {
                  const val = e.target.value;
                  setLoginId(val);
                  if (val === '0526T') {
                    setUserId('管理者'); setUploadGroup('教員'); setRole('teacher');
                    localStorage.setItem('photovox_id', '0526T'); localStorage.setItem('photovox_group', '教員');
                  }
                }} 
                style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '2px solid #edf2f7', boxSizing:'border-box', fontSize: '16px' }} 
              />
            </div>
            {loginId !== '0526T' && loginId.length > 0 && (
              <>
                {loginId.startsWith('Group') ? (
                  /* 班ID（GroupA等）でログインする場合のパスワード */
                  <div style={{marginBottom: '20px'}}>
                    <label style={{fontSize: '12px', color: '#666', marginLeft: '5px'}}>パスワード</label>
                    <input type="password" placeholder="パスワードを入力" onChange={e => {
                      if (e.target.value === '0519') {
                        setUserId(loginId); setUploadGroup(loginId); setRole('student');
                        localStorage.setItem('photovox_id', loginId); localStorage.setItem('photovox_group', loginId);
                      }
                    }} style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '2px solid #edf2f7', boxSizing:'border-box', fontSize: '16px' }} />
                  </div>
                ) : (
                  /* 学籍番号でログインする場合の班選択 */
                  <>
                    <div style={{marginBottom: '15px'}}>
                      <label style={{fontSize: '12px', color: '#666', marginLeft: '5px'}}>担当班を選択</label>
                      <select value={loginGroup} onChange={e => setLoginGroup(e.target.value)} style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '2px solid #edf2f7', background: '#fff', fontSize: '16px' }}>
                        <option value="">-- 班を選択 --</option>
                        {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <button onClick={() => { if(!loginGroup) return alert('班を選択してください'); setUserId(loginId); setUploadGroup(loginGroup); setRole('student'); localStorage.setItem('photovox_id', loginId); localStorage.setItem('photovox_group', loginGroup); }} style={{ width: '100%', padding: '18px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: '15px', fontWeight: 'bold' }}>ログイン</button>
                  </>
                )}
              </>
            )}
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

            {/* Step 1: 写真選択 */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#0070f3', marginBottom: '8px' }}>Step 1 📷 写真アップロード</div>
              <div onClick={() => fileInputRef.current?.click()} style={{ background: '#f0f7ff', padding: '30px', textAlign: 'center', border: '2px dashed #0070f3', borderRadius: '20px', cursor: 'pointer' }}>
                {imagePreview ? <img src={imagePreview} style={{ maxWidth: '100%', maxHeight: '250px', borderRadius:'10px' }} /> : '📷 写真を選択'}
                <input type="file" accept="image/*,.heic" ref={fileInputRef} onChange={e => { const f = e.target.files?.[0]; if(f) { setImageFile(f); const r = new FileReader(); r.onloadend = () => setImagePreview(r.result as string); r.readAsDataURL(f); } }} style={{ display: 'none' }} />
              </div>
            </div>

            {/* Step 2: 音声録音 */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#0070f3', marginBottom: '8px' }}>Step 2 🎤 音声録音→変換</div>
              {!audioBlob ? (
                <button onClick={isRecording ? stopRecording : startRecording} style={{ width: '100%', padding: '15px', borderRadius: '15px', background: isRecording ? '#e74c3c' : '#f1f5f9', color: isRecording ? '#fff' : '#333', border: 'none' }}>
                  {isRecording ? '🛑 録音を停止（文字起こし中）' : '🎙️ 音声メモを録音'}
                </button>
              ) : (
                <div style={{ background: '#f1f5f9', padding: '10px', borderRadius: '15px' }}>
                  <audio src={audioUrl ?? undefined} controls style={{ width: '100%' }} />
                  <button onClick={() => { if (audioUrl) URL.revokeObjectURL(audioUrl); setAudioBlob(null); setAudioUrl(null); setComment(''); }} style={{ marginTop: '5px', fontSize: '12px', color: '#e74c3c', background: 'none', border: 'none' }}>録音をやり直す</button>
                </div>
              )}
              {isTranscribing && <div style={{ fontSize: '12px', color: '#0070f3', marginTop: '6px', textAlign: 'center' }}>文字起こし中...</div>}
            </div>

            {/* Step 3: 文字起こし */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#0070f3', marginBottom: '8px' }}>Step 3 📝 テキスト（録音データ文字起こし）</div>
              <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="音声録音後に自動入力されます" style={{ width: '100%', height: '100px', padding: '15px', boxSizing:'border-box', borderRadius:'15px', border:'1px solid #ddd' }} />
            </div>

            {/* Step 4: 追加記入 */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#0070f3', marginBottom: '8px' }}>Step 4 ✏️ 追加記入（手入力）</div>
              <textarea value={extraNote} onChange={e => setExtraNote(e.target.value)} placeholder="補足・追加メモがあれば入力してください" style={{ width: '100%', height: '100px', padding: '15px', boxSizing:'border-box', borderRadius:'15px', border:'1px solid #ddd' }} />
            </div>

            <button onClick={handleUpload} disabled={uploading} style={{ width: '100%', padding: '20px', background: '#10b981', color: '#fff', borderRadius: '15px', fontWeight: 'bold', border:'none' }}>{uploading ? '送信中...' : '🚀 報告を送信'}</button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems:'center' }}>
              <h2 style={{ margin: 0, fontSize: '20px' }}>調査データ一覧</h2>
              <button onClick={() => setScreen('home')} style={{padding:'8px 15px', borderRadius:'10px', background:'#fff', border:'1px solid #ddd'}}>戻る</button>
            </div>
            {role === 'teacher' && (
              <>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  <button onClick={handleBulkDownload} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: '#0070f3', color: '#fff', border: 'none', fontWeight: 'bold' }}>📥 一括ダウンロード</button>
                  <button onClick={() => bulkUploadRef.current?.click()} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: '#fff', color: '#333', border: '1px solid #ddd', fontWeight: 'bold' }}>📤 一括アップロード</button>
                  <input type="file" accept=".csv" ref={bulkUploadRef} onChange={handleBulkUpload} style={{ display: 'none' }} />
                  <button onClick={() => setGroupByGroup(g => !g)} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: groupByGroup ? '#7c3aed' : '#fff', color: groupByGroup ? '#fff' : '#333', border: '1px solid #ddd', fontWeight: 'bold' }}>🗂 グループ別表示</button>
                </div>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  {['all', ...GROUPS].map(g => (
                    <button key={g} onClick={() => setFilterGroup(g)} style={{ padding: '6px 12px', borderRadius: '20px', border: 'none', background: filterGroup === g ? '#0070f3' : '#edf2f7', color: filterGroup === g ? '#fff' : '#555', fontWeight: filterGroup === g ? 'bold' : 'normal', fontSize: '13px' }}>
                      {g === 'all' ? '全て' : g}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '15px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#999' }}>並び順：</span>
                  {([['date_desc', '日付 新→古'], ['date_asc', '日付 古→新'], ['user_asc', '学籍番号 昇順'], ['user_desc', '学籍番号 降順']] as const).map(([val, label]) => (
                    <button key={val} onClick={() => setSortBy(val)} style={{ padding: '5px 10px', borderRadius: '20px', border: 'none', background: sortBy === val ? '#475569' : '#edf2f7', color: sortBy === val ? '#fff' : '#555', fontSize: '12px' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
            {statusMsg && <div style={{textAlign:'center', padding:'20px', color:'#0070f3'}}>{statusMsg}</div>}
            {(() => {
              const base = role === 'teacher' && filterGroup !== 'all' ? posts.filter(p => p.group_name === filterGroup) : posts;
              const filtered = [...base].sort((a, b) => {
                if (sortBy === 'date_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                if (sortBy === 'date_asc')  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                if (sortBy === 'user_asc')  return (a.user_id || '').localeCompare(b.user_id || '', 'ja');
                if (sortBy === 'user_desc') return (b.user_id || '').localeCompare(a.user_id || '', 'ja');
                return 0;
              });
              const postCard = (p: any) => (
                <div key={p.id} style={{ background: '#fff', borderRadius: '25px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', position: 'relative' }}>
                  {(role === 'teacher' || p.user_id === userId) && (
                    <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '5px', zIndex: 5 }}>
                      <button onClick={() => { setEditingId(p.id); setEditingText(p.theme || ''); }} style={{ background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', width: '30px', height: '30px', color: '#0070f3', cursor: 'pointer', fontWeight: 'bold' }}>✏️</button>
                      <button onClick={() => handleDelete(p.id, p.photo_url, p.audio_url)} style={{ background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', width: '30px', height: '30px', color: '#e74c3c', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
                    </div>
                  )}
                  <img src={getThumbUrl(p.photo_url)} loading="lazy" style={{ width: '100%', minHeight: '200px', objectFit: 'cover' }} />
                  <div style={{ padding: '20px' }}>
                    <div style={{ fontWeight: 'bold', color: '#0070f3', marginBottom:'4px' }}>{p.group_name} <span style={{color:'#999', fontSize:'12px', fontWeight:'normal'}}>{p.user_id}</span></div>
                    <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '10px' }}>{p.created_at ? new Date(p.created_at).toLocaleString('ja-JP', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : ''}</div>
                    {editingId === p.id ? (
                      <div>
                        <textarea value={editingText} onChange={e => setEditingText(e.target.value)} style={{ width: '100%', height: '100px', padding: '10px', boxSizing: 'border-box', borderRadius: '10px', border: '1px solid #0070f3', marginBottom: '8px' }} />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => handleEdit(p.id)} style={{ flex: 1, padding: '8px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>保存</button>
                          <button onClick={() => setEditingId(null)} style={{ flex: 1, padding: '8px', background: '#eee', color: '#333', border: 'none', borderRadius: '8px' }}>キャンセル</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p style={{ marginBottom: '10px' }}>{p.theme}</p>
                        {role === 'teacher' && !p.theme && p.audio_url && (
                          <div style={{ marginTop: '8px' }}>
                            <audio src={getFullUrl(p.audio_url)} controls style={{ width: '100%', height: '35px', marginBottom: '8px' }} />
                            <button onClick={() => handleTranscribe(p.id, p.audio_url)} disabled={transcribingId === p.id} style={{ width: '100%', padding: '8px', background: transcribingId === p.id ? '#94a3b8' : '#7c3aed', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px' }}>
                              {transcribingId === p.id ? '⏳ 文字起こし中...' : '🤖 Whisperで自動文字起こし'}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );

              if (groupByGroup) {
                const grouped = GROUPS.map(g => ({ group: g, items: filtered.filter(p => p.group_name === g) })).filter(g => g.items.length > 0);
                return grouped.map(({ group, items }) => (
                  <div key={group} style={{ marginBottom: '30px' }}>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#7c3aed', padding: '8px 14px', background: '#f5f3ff', borderRadius: '12px', marginBottom: '12px' }}>{group} ({items.length}件)</div>
                    <div style={{ display: 'grid', gap: '20px' }}>{items.map(postCard)}</div>
                  </div>
                ));
              }
              return <div style={{ display: 'grid', gap: '20px' }}>{filtered.map(postCard)}</div>;
            })()}
          </div>
        )}
      </main>
    </div>
  )
}