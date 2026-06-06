'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import JSZip from 'jszip'

const SUPABASE_URL = 'https://zlpcaxrjwlbrisyurfdr.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpscGNheHJqd2xicmlzeXVyZmRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTkxNTcsImV4cCI6MjA5MDA5NTE1N30.BT4yx6ipKUvM-nieU0d0ofbiUqUE7hY4Q3x1EYI_Bs8'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const GROUPS = ['GroupA','GroupB','GroupC','GroupD','GroupE','GroupF','GroupG','GroupH']
const PAGE_SIZE = 15

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
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [postNumbers, setPostNumbers] = useState<Record<number, number>>({})
  const [viewMode, setViewMode] = useState<'card' | 'tile'>('card')

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
    return `${SUPABASE_URL}/storage/v1/render/image/public/photos/${fileName}?width=600&quality=60`;
  };

  const fetchPosts = async (pageNum = 0, append = false) => {
    if (!append) setStatusMsg('読み込み中...');
    else setLoadingMore(true);
    try {
      let query = supabase.from('posts').select('*');

      if (role === 'teacher') {
        if (filterGroup !== 'all') query = query.eq('group_name', filterGroup);
      } else if (userId.startsWith('Group')) {
        query = query.eq('group_name', userId);
      } else {
        query = query.eq('user_id', userId);
      }

      if (sortBy === 'date_asc') query = query.order('id', { ascending: true });
      else if (sortBy === 'user_asc') query = query.order('user_id', { ascending: true });
      else if (sortBy === 'user_desc') query = query.order('user_id', { ascending: false });
      else query = query.order('id', { ascending: false });

      query = query.range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

      const { data, error } = await query;
      if (error) throw error;

      if (append) {
        setPosts(prev => [...prev, ...(data || [])]);
      } else {
        setPosts(data || []);
      }
      setHasMore((data?.length ?? 0) === PAGE_SIZE);
      if (!append) setStatusMsg(data?.length === 0 ? 'データがありません' : '');
    } catch (err) {
      setStatusMsg('エラーが発生しました');
    } finally {
      setLoadingMore(false);
    }
  };

  const computeGroupNumbers = async () => {
    const { data } = await supabase
      .from('posts')
      .select('id, group_name')
      .order('group_name', { ascending: true })
      .order('id', { ascending: true });
    if (data) {
      const counters: Record<string, number> = {};
      const numbers: Record<number, number> = {};
      for (const post of data) {
        counters[post.group_name] = (counters[post.group_name] || 0) + 1;
        numbers[post.id] = counters[post.group_name];
      }
      setPostNumbers(numbers);
    }
  };

  useEffect(() => {
    if (screen === 'gallery') {
      setPage(0);
      setHasMore(true);
      fetchPosts(0, false);
      computeGroupNumbers();
    }
  }, [screen, role, userId, filterGroup, sortBy]);

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchPosts(next, true);
  };

  const refreshPosts = () => {
    setPage(0);
    setHasMore(true);
    fetchPosts(0, false);
  };

  const handleGroupBulkDownload = async () => {
    setDownloading(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('group_name', userId)
        .order('id', { ascending: true });
      if (error) throw error;

      const zip = new JSZip();

      for (const post of (data || [])) {
        if (post.photo_url) {
          try {
            const url = getFullUrl(post.photo_url);
            const response = await fetch(url);
            if (response.ok) {
              const blob = await response.blob();
              const ext = (url.split('.').pop() || 'jpg').split('?')[0];
              zip.file(`${post.user_id}_${post.id}.${ext}`, blob);
            }
          } catch {}
        }
        if (post.audio_url) {
          try {
            const url = getFullUrl(post.audio_url);
            const response = await fetch(url);
            if (response.ok) {
              const blob = await response.blob();
              zip.file(`${post.user_id}_${post.id}.webm`, blob);
            }
          } catch {}
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `${userId}_photos.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      alert('ダウンロードに失敗しました');
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadAudio = async (audioUrl: string, postUserId: string, postId: number) => {
    const url = getFullUrl(audioUrl);
    const response = await fetch(url);
    const blob = new Blob([await response.arrayBuffer()], { type: 'audio/webm' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${postUserId}_${postId}.webm`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const handleDownloadPhoto = async (photoUrl: string, postUserId: string, postId: number) => {
    const url = getFullUrl(photoUrl);
    const response = await fetch(url);
    const blob = await response.blob();
    const ext = (url.split('.').pop() || 'jpg').split('?')[0];
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${postUserId}_${postId}.${ext}`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleBulkDownload = async () => {
    let query = supabase.from('posts').select('*');
    if (filterGroup !== 'all') query = query.eq('group_name', filterGroup);
    query = query.order('id', { ascending: true });
    const { data, error } = await query;
    if (error || !data) return alert('ダウンロードに失敗しました');

    const c = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const headers = ['ID', 'グループ', 'ユーザーID', '文字起こし', '手動テキスト', '写真ファイル名'];
    const rows = data.map(p => {
      const parts = (p.theme || '').split('\n【追加記入】\n');
      const photoName = p.photo_url ? `${p.user_id}_${p.id}.jpg` : '';
      return [p.id, c(p.group_name), c(p.user_id), c(parts[0] || ''), c(parts[1] || ''), c(photoName)].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `photovox_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (line[i] === ',' && !inQ) {
        result.push(cur); cur = '';
      } else cur += line[i];
    }
    result.push(cur);
    return result;
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const raw = await file.text();
    const content = raw.startsWith('﻿') ? raw.slice(1) : raw;
    const lines = content.split(/\r?\n/).slice(1).filter(l => l.trim());
    if (lines.length === 0) return alert('データがありません');

    let updated = 0, failed = 0;
    for (const line of lines) {
      const cols = parseCSVLine(line);
      const id = parseInt(cols[0]);
      if (!id) continue;
      const transcription = (cols[3] || '').trim();
      const manual = (cols[4] || '').trim();
      const theme = (transcription || manual)
        ? `${transcription}\n【追加記入】\n${manual}`
        : '';
      const { error } = await supabase.from('posts').update({ theme }).eq('id', id);
      if (error) failed++; else updated++;
    }
    alert(failed > 0 ? `${updated}件更新、${failed}件失敗しました` : `${updated}件を更新しました`);
    e.target.value = '';
    refreshPosts();
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
      const post = posts.find(p => p.id === postId)
      const existingManual = (post?.theme || '').includes('【追加記入】')
        ? post.theme.split('\n【追加記入】\n')[1]
        : ''
      const newTheme = existingManual ? `${text}\n【追加記入】\n${existingManual}` : text
      const { error: dbError } = await supabase.from('posts').update({ theme: newTheme }).eq('id', postId)
      if (dbError) throw dbError
      refreshPosts()
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
    refreshPosts();
  };

  const handleDelete = async (postId: number, photoPath: string, audioPath: string) => {
    if (!confirm('この投稿を削除してもよろしいですか？')) return;
    try {
      const { error } = await supabase.from('posts').delete().eq('id', postId);
      if (error) throw error;
      if (photoPath) await supabase.storage.from('photos').remove([photoPath]);
      if (audioPath) await supabase.storage.from('photos').remove([audioPath]);
      alert('削除しました');
      refreshPosts();
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
      const theme = (comment.trim() || extraNote.trim())
        ? `${comment.trim()}\n【追加記入】\n${extraNote.trim()}`
        : '';
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
                  if (val.toUpperCase() === '0526T') {
                    setUserId('管理者'); setUploadGroup('教員'); setRole('teacher');
                    localStorage.setItem('photovox_id', '0526T'); localStorage.setItem('photovox_group', '教員');
                  }
                }}
                style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '2px solid #edf2f7', boxSizing:'border-box', fontSize: '16px' }}
              />
            </div>
            {loginId.toUpperCase() !== '0526T' && loginId.length > 0 && (
              <>
                {GROUPS.some(g => g.toLowerCase() === loginId.toLowerCase()) ? (
                  <div style={{marginBottom: '20px'}}>
                    <label style={{fontSize: '12px', color: '#666', marginLeft: '5px'}}>パスワード</label>
                    <input type="password" placeholder="パスワードを入力" onChange={e => {
                      if (e.target.value === '0519') {
                        const normalizedGroup = GROUPS.find(g => g.toLowerCase() === loginId.toLowerCase()) || loginId;
                        setUserId(normalizedGroup); setUploadGroup(normalizedGroup); setRole('student');
                        localStorage.setItem('photovox_id', normalizedGroup); localStorage.setItem('photovox_group', normalizedGroup);
                      }
                    }} style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '2px solid #edf2f7', boxSizing:'border-box', fontSize: '16px' }} />
                  </div>
                ) : (
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
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button onClick={() => setViewMode('card')} style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', background: viewMode === 'card' ? '#0070f3' : '#edf2f7', color: viewMode === 'card' ? '#fff' : '#555', fontWeight: 'bold', fontSize: '13px' }}>☰ カード</button>
                <button onClick={() => setViewMode('tile')} style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', background: viewMode === 'tile' ? '#0070f3' : '#edf2f7', color: viewMode === 'tile' ? '#fff' : '#555', fontWeight: 'bold', fontSize: '13px' }}>⊞ タイル</button>
                <button onClick={() => setScreen('home')} style={{padding:'8px 15px', borderRadius:'10px', background:'#fff', border:'1px solid #ddd'}}>戻る</button>
              </div>
            </div>
            {userId.startsWith('Group') && (
              <div style={{ marginBottom: '15px' }}>
                <button onClick={handleGroupBulkDownload} disabled={downloading} style={{ width: '100%', padding: '12px', borderRadius: '12px', background: downloading ? '#94a3b8' : '#0070f3', color: '#fff', border: 'none', fontWeight: 'bold', fontSize: '15px' }}>
                  {downloading ? '⏳ ダウンロード中...' : '📥 写真を一括ダウンロード（ZIP）'}
                </button>
              </div>
            )}
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
              const postCard = (p: any) => (
                <div key={p.id} style={{ background: '#fff', borderRadius: '25px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '5px', zIndex: 5 }}>
                    <button onClick={() => handleDownloadPhoto(p.photo_url, p.user_id, p.id)} style={{ background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', fontWeight: 'bold' }}>⬇️</button>
                    {p.audio_url && <button onClick={() => handleDownloadAudio(p.audio_url, p.user_id, p.id)} style={{ background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', fontWeight: 'bold' }}>🔊</button>}
                    {(role === 'teacher' || p.user_id === userId) && (
                      <>
                        <button onClick={() => { setEditingId(p.id); setEditingText(p.theme || ''); }} style={{ background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', width: '30px', height: '30px', color: '#0070f3', cursor: 'pointer', fontWeight: 'bold' }}>✏️</button>
                        <button onClick={() => handleDelete(p.id, p.photo_url, p.audio_url)} style={{ background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', width: '30px', height: '30px', color: '#e74c3c', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
                      </>
                    )}
                  </div>
                  {postNumbers[p.id] && (
                    <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(0,0,0,0.55)', color: '#fff', borderRadius: '20px', padding: '3px 10px', fontWeight: 'bold', fontSize: '14px', zIndex: 5, letterSpacing: '0.5px' }}>
                      {p.group_name.replace('Group', '')}{postNumbers[p.id]}
                    </div>
                  )}
                  <img src={getThumbUrl(p.photo_url)} loading="lazy" onError={e => { (e.target as HTMLImageElement).src = getFullUrl(p.photo_url) }} style={{ width: '100%', minHeight: '200px', objectFit: 'cover' }} />
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
                        {(() => {
                          const parts = (p.theme || '').split('\n【追加記入】\n')
                          const transcription = parts[0]
                          const manual = parts[1]
                          return (
                            <>
                              {transcription ? (
                                <div style={{ marginBottom: '10px' }}>
                                  {role === 'teacher' && <div style={{ fontSize: '11px', color: '#0070f3', marginBottom: '3px' }}>🎤 文字起こし</div>}
                                  <p style={{ margin: 0 }}>{transcription}</p>
                                </div>
                              ) : null}
                              {manual ? (
                                <div style={{ marginBottom: '10px', background: '#f8fafc', borderRadius: '8px', padding: '8px 12px' }}>
                                  <div style={{ fontSize: '11px', color: '#10b981', marginBottom: '3px' }}>✏️ 手入力メモ</div>
                                  <p style={{ margin: 0 }}>{manual}</p>
                                </div>
                              ) : null}
                              {role === 'teacher' && p.audio_url && (
                                <div style={{ marginTop: '8px' }}>
                                  {!p.theme && <audio src={getFullUrl(p.audio_url)} controls style={{ width: '100%', height: '35px', marginBottom: '8px' }} />}
                                  <button onClick={() => handleTranscribe(p.id, p.audio_url)} disabled={transcribingId === p.id} style={{ width: '100%', padding: '8px', background: transcribingId === p.id ? '#94a3b8' : '#7c3aed', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px' }}>
                                    {transcribingId === p.id ? '⏳ 文字起こし中...' : '🤖 Whisperで自動文字起こし'}
                                  </button>
                                </div>
                              )}
                            </>
                          )
                        })()}
                      </>
                    )}
                  </div>
                </div>
              );

              const tileCard = (p: any) => (
                <div key={p.id} style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', aspectRatio: '1' }}>
                  <img src={getThumbUrl(p.photo_url)} loading="lazy" onError={e => { (e.target as HTMLImageElement).src = getFullUrl(p.photo_url) }} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  {postNumbers[p.id] && (
                    <div style={{ position: 'absolute', top: '6px', left: '6px', background: 'rgba(0,0,0,0.55)', color: '#fff', borderRadius: '12px', padding: '2px 7px', fontWeight: 'bold', fontSize: '11px' }}>
                      {p.group_name.replace('Group', '')}{postNumbers[p.id]}
                    </div>
                  )}
                  <div style={{ position: 'absolute', top: '6px', right: '6px', display: 'flex', gap: '3px' }}>
                    <button onClick={() => handleDownloadPhoto(p.photo_url, p.user_id, p.id)} style={{ background: 'rgba(255,255,255,0.85)', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', fontSize: '11px' }}>⬇️</button>
                    {p.audio_url && <button onClick={() => handleDownloadAudio(p.audio_url, p.user_id, p.id)} style={{ background: 'rgba(255,255,255,0.85)', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', fontSize: '11px' }}>🔊</button>}
                  </div>
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.5))', color: '#fff', padding: '12px 8px 6px', fontSize: '10px' }}>
                    {p.group_name} · {p.user_id}
                  </div>
                </div>
              );

              if (viewMode === 'tile') {
                if (groupByGroup) {
                  const grouped = GROUPS.map(g => ({ group: g, items: posts.filter(p => p.group_name === g) })).filter(g => g.items.length > 0);
                  return (
                    <>
                      {grouped.map(({ group, items }) => (
                        <div key={group} style={{ marginBottom: '30px' }}>
                          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#7c3aed', padding: '8px 14px', background: '#f5f3ff', borderRadius: '12px', marginBottom: '12px' }}>{group} ({items.length}件)</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>{items.map(tileCard)}</div>
                        </div>
                      ))}
                    </>
                  );
                }
                return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>{posts.map(tileCard)}</div>;
              }

              if (groupByGroup) {
                const grouped = GROUPS.map(g => ({ group: g, items: posts.filter(p => p.group_name === g) })).filter(g => g.items.length > 0);
                return (
                  <>
                    {grouped.map(({ group, items }) => (
                      <div key={group} style={{ marginBottom: '30px' }}>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#7c3aed', padding: '8px 14px', background: '#f5f3ff', borderRadius: '12px', marginBottom: '12px' }}>{group} ({items.length}件)</div>
                        <div style={{ display: 'grid', gap: '20px' }}>{items.map(postCard)}</div>
                      </div>
                    ))}
                  </>
                );
              }
              return <div style={{ display: 'grid', gap: '20px' }}>{posts.map(postCard)}</div>;
            })()}
            {hasMore && (
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                style={{ width: '100%', marginTop: '20px', padding: '14px', borderRadius: '12px', background: loadingMore ? '#e2e8f0' : '#f1f5f9', color: loadingMore ? '#94a3b8' : '#475569', border: '1px solid #e2e8f0', fontWeight: 'bold', fontSize: '14px', cursor: loadingMore ? 'default' : 'pointer' }}
              >
                {loadingMore ? '読み込み中...' : 'もっと見る'}
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
