import React, { useState, useEffect } from 'react';
import { Send, LogOut, Loader2 } from 'lucide-react';

export default function App() {
  const [step, setStep] = useState(0); // 0=загрузка, 1=логин, 2=код, 3=чаты
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [hash, setHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(localStorage.getItem('mg_session') || null);
  const [dialogs, setDialogs] = useState([]);

  // ТВОЯ ССЫЛКА НА БЭКЕНД RENDER (уже вписана)
  const BACKEND_URL = 'https://morphygram.onrender.com'; 

  useEffect(() => {
    const timer = setTimeout(() => {
      if (session) {
        fetchChats(session);
      } else {
        setStep(1);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [session]);

  const fetchChats = async (sess) => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/get-chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: sess })
      });
      const data = await res.json();
      if (res.ok) {
        setDialogs(data.dialogs);
        setStep(3);
      } else {
        localStorage.removeItem('mg_session');
        setStep(1);
      }
    } catch (e) {
      alert('Ошибка загрузки чатов. Возможно, сессия устарела.');
      localStorage.removeItem('mg_session');
      setStep(1);
    }
    setLoading(false);
  };

  const handleSendCode = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = await res.json();
      if (res.ok) {
        setHash(data.phone_code_hash);
        setStep(2);
      } else { alert(data.detail); }
    } catch (e) { alert('Ошибка соединения с сервером'); }
    setLoading(false);
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code, phone_code_hash: hash })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('mg_session', data.session);
        setSession(data.session);
        fetchChats(data.session);
      } else { alert(data.detail); }
    } catch (e) { alert('Ошибка соединения с сервером'); }
    setLoading(false);
  };

  const logout = () => {
    localStorage.removeItem('mg_session');
    setSession(null);
    setStep(1);
    setDialogs([]);
  };

  // --- 0: ЭКРАН ЗАГРУЗКИ (ТУТ ТВОЕ ВИДЕО) ---
  if (step === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-morphy relative overflow-hidden">
        <video 
          autoPlay 
          loop 
          muted 
          playsInline 
          className="w-64 h-64 object-contain absolute z-0 opacity-80"
        >
          <source src="/splash.mp4" type="video/mp4" />
        </video>
        
        <div className="z-10 mt-64 text-slate-500 font-mono text-xs tracking-widest animate-pulse">
          MORPHYGRAM
        </div>
      </div>
    );
  }

  // --- 1 и 2: ЛОГИН ---
  if (step === 1 || step === 2) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-morphy">
        <div className="w-full max-w-sm p-8 bg-slate-900/50 border border-slate-800 rounded-3xl backdrop-blur-xl shadow-2xl relative">
          
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight mb-2">MorphyGram</h1>
            <p className="text-slate-400 text-sm">Твой защищенный клиент</p>
          </div>

          {step === 1 ? (
            <div className="space-y-5">
              <div>
                <input type="text" placeholder="+7 999 111 22 33" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-4 text-center text-lg focus:outline-none focus:border-slate-500 transition" />
              </div>
              <button onClick={handleSendCode} disabled={loading} className="w-full bg-white text-black font-semibold py-4 rounded-xl transition hover:bg-slate-200 disabled:opacity-50 flex justify-center">
                {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Продолжить'}
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <input type="text" placeholder="Код из Telegram" value={code} onChange={(e) => setCode(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-4 text-center tracking-widest text-lg focus:outline-none focus:border-slate-500 transition" />
              </div>
              <button onClick={handleLogin} disabled={loading} className="w-full bg-white text-black font-semibold py-4 rounded-xl transition hover:bg-slate-200 disabled:opacity-50 flex justify-center">
                {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Войти'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- 3: ЧАТЫ ---
  return (
    <div className="flex flex-col h-screen bg-morphy">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/30 backdrop-blur-md sticky top-0 z-10">
        <h1 className="font-bold text-xl tracking-tight">MorphyGram</h1>
        <button onClick={logout} className="text-slate-500 hover:text-white transition">
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
           <div className="flex justify-center mt-10"><Loader2 className="animate-spin w-8 h-8 text-slate-500" /></div>
        ) : (
          dialogs.map((d) => (
            <div key={d.id} className="flex items-center gap-4 p-4 border-b border-slate-800/50 hover:bg-slate-900/50 transition cursor-pointer">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-400">
                {d.title ? d.title.charAt(0) : '#'}
              </div>
              <div className="flex-1">
                <div className="font-semibold">{d.title || 'Без названия'}</div>
                <div className="text-sm text-slate-500 truncate">Нажми, чтобы открыть чат</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
