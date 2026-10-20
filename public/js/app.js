/* MorphyGram — клиентская логика (Socket.IO) */
/* global io */

const $ = (s) => document.querySelector(s);
const socket = io({ transports: ['websocket', 'polling'] });

const state = {
  token: localStorage.getItem('mg_token') || null,
  me: null,
  currentChat: null,
  dialogs: new Map(),   // key -> {key,title,type,unread,last}
  msgs: new Map(),      // id -> элемент текущего чата (для апдейтов)
};

/* =================-auth (как в Telegram)================= */
// [название, код страны ISO, код набора]
const COUNTRIES = [
  ['Ukraine', 'UA', '380'], ['Russia', 'RU', '7'], ['Belarus', 'BY', '375'],
  ['Kazakhstan', 'KZ', '7'], ['Kyrgyzstan', 'KG', '996'], ['Uzbekistan', 'UZ', '998'],
  ['Armenia', 'AM', '374'], ['Azerbaijan', 'AZ', '994'], ['Georgia', 'GE', '995'],
  ['Moldova', 'MD', '373'], ['Latvia', 'LV', '371'], ['Lithuania', 'LT', '370'],
  ['Estonia', 'EE', '372'], ['Poland', 'PL', '48'], ['Czechia', 'CZ', '420'],
  ['Germany', 'DE', '49'], ['France', 'FR', '33'], ['Italy', 'IT', '39'],
  ['Spain', 'ES', '34'], ['Netherlands', 'NL', '31'], ['United Kingdom', 'GB', '44'],
  ['Sweden', 'SE', '46'], ['Finland', 'FI', '358'], ['Serbia', 'RS', '381'],
  ['Turkey', 'TR', '90'], ['Israel', 'IL', '972'], ['United Arab Emirates', 'AE', '971'],
  ['United States', 'US', '1'], ['Canada', 'CA', '1'], ['Mexico', 'MX', '52'],
  ['Brazil', 'BR', '55'], ['China', 'CN', '86'], ['Japan', 'JP', '81'],
  ['India', 'IN', '91'],
];
const flagOf = (iso) => String.fromCodePoint(...[...iso].map((c) => 127397 + c.charCodeAt(0)));
let country = COUNTRIES[0];

const TITLES = {
  phone: ['Your Phone', 'Please confirm your country code and enter your phone number.'],
  code: ['Enter code', 'We have sent the code to your Telegram.'],
  password: ['Enter a Password', 'Your account is protected with an additional password.'],
};
const AUTH_STEPS = ['phone', 'code', 'password'];

function showStep(name) {
  AUTH_STEPS.forEach((s) => $('#step-' + s).classList.toggle('hidden', s !== name));
  $('#auth-title').textContent = TITLES[name][0];
  $('#auth-sub').textContent = TITLES[name][1];
}
function authError(msg) { $('#auth-error').textContent = msg || ''; }
function authStatus(msg) { $('#auth-status').textContent = msg || ''; }
function digits(v) { return String(v || '').replace(/\D/g, ''); }

function updateButtons() {
  $('#btn-phone').disabled = digits($('#phone').value).length < 7;
  $('#btn-code').disabled = digits($('#code').value).length < 5;
  $('#btn-password').disabled = !$('#password').value;
}

function renderCountry() {
  $('#country-flag').textContent = flagOf(country[1]);
  $('#country-name').textContent = country[0];
  $('#dial').textContent = '+' + country[2];
}

function renderCountryList(q) {
  const list = $('#country-list');
  const s = q.trim().toLowerCase();
  list.innerHTML = '';
  COUNTRIES
    .filter((c) => !s || c[0].toLowerCase().includes(s) || c[2].startsWith(s.replace('+', '')))
    .forEach((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tg-country-item';
      b.innerHTML = '<span class="tg-flag"></span><span class="tg-cname"></span><span class="tg-cdial"></span>';
      b.querySelector('.tg-flag').textContent = flagOf(c[1]);
      b.querySelector('.tg-cname').textContent = c[0];
      b.querySelector('.tg-cdial').textContent = '+' + c[2];
      b.addEventListener('click', () => {
        country = c;
        renderCountry();
        $('#countries-modal').classList.add('hidden');
        $('#phone').focus();
      });
      list.appendChild(b);
    });
}

function showLogin() {
  $('#login').classList.remove('hidden');
  $('#main').classList.add('hidden');
  showStep('phone');
  authError(); authStatus();
  updateButtons();
}

function showApp() {
  $('#login').classList.add('hidden');
  $('#main').classList.remove('hidden');
  $('#me-name').textContent = state.me.name || 'Я';
  $('#me-phone').textContent = state.me.phone ? '+' + state.me.phone : '';
  socket.emit('dialogs:list');
}

renderCountry();

$('#btn-country').addEventListener('click', () => {
  $('#countries-modal').classList.remove('hidden');
  $('#country-search').value = '';
  renderCountryList('');
  $('#country-search').focus();
});
$('#btn-country-close').addEventListener('click', () => $('#countries-modal').classList.add('hidden'));
$('#countries-modal').addEventListener('click', (e) => { if (e.target.id === 'countries-modal') $('#countries-modal').classList.add('hidden'); });
$('#country-search').addEventListener('input', (e) => renderCountryList(e.target.value));

$('#phone').addEventListener('input', () => { $('#phone').value = digits($('#phone').value); updateButtons(); });
$('#code').addEventListener('input', () => { $('#code').value = digits($('#code').value).slice(0, 6); updateButtons(); });
$('#password').addEventListener('input', updateButtons);

$('#btn-phone').addEventListener('click', () => {
  const d = digits($('#phone').value);
  if (d.length < 7) return;
  authError(); authStatus('Отправляю код…');
  $('#btn-phone').disabled = true;
  socket.emit('auth:phone', { phone: '+' + country[2] + d });
});
$('#btn-code').addEventListener('click', () => {
  const c = digits($('#code').value);
  if (c.length < 5) return;
  authError(); authStatus('Проверяю код…');
  socket.emit('auth:code', { code: c });
});
$('#btn-password').addEventListener('click', () => {
  const p = $('#password').value;
  if (!p) return;
  authError(); authStatus('Проверяю пароль…');
  socket.emit('auth:password', { password: p });
});
$('#btn-back-phone').addEventListener('click', () => { authError(); authStatus(); showStep('phone'); updateButtons(); });

['phone', 'code', 'password'].forEach((id) => {
  $('#' + id).addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !$('#btn-' + id).disabled) $('#btn-' + id).click();
  });
});

$('#btn-logout').addEventListener('click', () => socket.emit('logout'));

socket.on('connect', () => {
  if (state.token) {
    authStatus('Восстанавливаю сессию…');
    socket.emit('auth:resume', { token: state.token });
  } else {
    showLogin();
  }
});
socket.on('auth:ok', ({ token, me }) => {
  state.token = token;
  state.me = me;
  localStorage.setItem('mg_token', token);
  authStatus(); authError();
  showApp();
});
socket.on('auth:expired', () => {
  state.token = null; state.me = null;
  localStorage.removeItem('mg_token');
  showLogin();
});
socket.on('auth:status', (msg) => authStatus(msg));
socket.on('auth:need_code', (info) => {
  const sub = info && info.via === 'app' ? 'We have sent the code to the Telegram app on your other device.'
    : info && info.via === 'sms' ? 'We have sent you an SMS with the code.'
    : 'We have sent the code to your Telegram or SMS.';
  showStep('code');
  $('#auth-sub').textContent = sub;
  $('#code').value = '';
  authStatus(); authError(); updateButtons();
  $('#code').focus();
});
socket.on('auth:need_password', () => {
  authStatus(); authError(); showStep('password'); updateButtons();
  $('#password').focus();
});
socket.on('auth:error', (msg) => { authStatus(); authError(msg); updateButtons(); });
socket.on('auth:failed', (msg) => { authStatus(); authError(msg); showStep('phone'); updateButtons(); });

/* =================dialogs================= */
socket.on('dialogs', ({ list }) => {
  state.dialogs.clear();
  list.forEach((d) => state.dialogs.set(d.key, d));
  renderDialogs();
});
socket.on('dialog:avatar', ({ key, data }) => {
  const el = document.querySelector('.dlg[data-key="' + cssEsc(key) + '"] .ava');
  if (el) {
    el.innerHTML = '<img alt="" src="' + data + '">';
  }
  const d = state.dialogs.get(key);
  if (d) d.ava = data;
});

function renderDialogs() {
  const box = $('#dialogs');
  box.innerHTML = '';
  const arr = [...state.dialogs.values()].sort((a, b) => ((b.last && b.last.date) || 0) - ((a.last && a.last.date) || 0));
  if (!arr.length) {
    box.innerHTML = '<div class="dlg-loading">Чатов не найдено</div>';
    return;
  }
  for (const d of arr) {
    const el = document.createElement('div');
    el.className = 'dlg' + (state.currentChat === d.key ? ' active' : '');
    el.dataset.key = d.key;
    const letter = (d.title || '?').trim().charAt(0).toUpperCase();
    const mark = d.last && /\(удалено\)|\[удалено\]/i.test(d.last.text)
      ? ' <span class="mark">☠</span>' : '';
    el.innerHTML =
      '<div class="ava">' + letter + '</div>' +
      '<div class="dlg-body">' +
        '<div class="dlg-title">' + esc(d.title) + '</div>' +
        '<div class="dlg-last">' + (d.last ? esc(d.last.text) + mark : '<span class="dim">…</span>') + '</div>' +
      '</div>' +
      (d.unread ? '<div class="dlg-unread">' + d.unread + '</div>' : '');
    el.addEventListener('click', () => openChat(d.key));
    box.appendChild(el);
    if (d.ava) el.querySelector('.ava').innerHTML = '<img alt="" src="' + d.ava + '">';
  }
}

function updateDialogPreview(chatKey, text, date) {
  const d = state.dialogs.get(chatKey);
  if (!d || !text) return;
  d.last = { text, date: date || (d.last && d.last.date) || 0 };
  if (state.currentChat !== chatKey) d.unread = (d.unread || 0) + 1;
  renderDialogs();
}

/* =================messages================= */
function openChat(key) {
  state.currentChat = key;
  const d = state.dialogs.get(key);
  $('#chat-title').textContent = d ? d.title : 'Чат';
  $('#messages').innerHTML = '<div class="dlg-loading">Загружаю сообщения…</div>';
  state.msgs.clear();
  document.querySelector('.main').classList.add('chat-open');
  renderDialogs();
  socket.emit('messages:load', { chatKey: key });
}

$('#btn-back').addEventListener('click', () => {
  document.querySelector('.main').classList.remove('chat-open');
  state.currentChat = null;
});

socket.on('messages', ({ chatKey, list }) => {
  if (state.currentChat !== chatKey) return;
  const box = $('#messages');
  box.innerHTML = '';
  state.msgs.clear();
  // сервер отдаёт от новых к старым — разворачиваем
  const chrono = [...list].sort((a, b) => a.date - b.date);
  let lastDay = '';
  for (const m of chrono) {
    const day = new Date(m.date * 1000).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    if (day !== lastDay) {
      lastDay = day;
      const sep = document.createElement('div');
      sep.className = 'day-sep';
      sep.textContent = day;
      box.appendChild(sep);
    }
    box.appendChild(buildMsg(m));
  }
  box.scrollTop = box.scrollHeight;
});

socket.on('update:message', ({ chatKey, msg }) => {
  updateDialogPreview(chatKey, msg.text || (msg.media ? '📎 медиа' : ''), msg.date);
  if (state.currentChat !== chatKey) return;
  const box = $('#messages');
  const isEmpty = box.querySelector('.empty-msg, .dlg-loading');
  if (isEmpty) box.innerHTML = '';
  // убрать «пусто», добавить
  box.appendChild(buildMsg(msg));
  box.scrollTop = box.scrollHeight;
});

socket.on('update:edited', ({ chatKey, msg }) => {
  if (state.currentChat !== chatKey) return;
  const old = state.msgs.get(msg.id);
  if (old) old.replaceWith(buildMsg(msg));
});

socket.on('update:deleted', ({ chatKey, id }) => {
  updateDialogPreview(chatKey, '(удалено)');
  if (state.currentChat !== chatKey) return;
  const el = state.msgs.get(id);
  if (el && !el.classList.contains('deleted')) {
    el.classList.add('deleted');
    const meta = el.querySelector('.meta');
    const b = document.createElement('span');
    b.className = 'badge badge-del';
    b.textContent = 'УДАЛЕНО';
    meta.prepend(b);
  }
});

socket.on('media', ({ chatKey, msgId, url }) => {
  if (state.currentChat !== chatKey) return;
  const el = state.msgs.get(msgId);
  if (!el) return;
  const holder = el.querySelector('.msg-media');
  if (holder) { holder.innerHTML = ''; holder.appendChild(mediaEl(el.dataset.media ? JSON.parse(el.dataset.media) : { type: 'file' }, url)); }
});

socket.on('app:error', (msg) => toast(msg));

/* отправка */
function send() {
  const inp = $('#input');
  const text = inp.value.trim();
  if (!text || !state.currentChat) return;
  socket.emit('message:send', { chatKey: state.currentChat, text });
  inp.value = '';
}
$('#btn-send').addEventListener('click', send);
$('#input').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });

/* =================рендер сообщения================= */
function buildMsg(m) {
  const el = document.createElement('div');
  el.className = 'msg ' + (m.out ? 'out' : 'in') + (m.deleted ? ' deleted' : '');
  el.dataset.id = m.id;
  if (m.media) el.dataset.media = JSON.stringify(m.media);

  let html = '';
  if (!m.out && m.from) html += '<div class="from">' + esc(m.from) + '</div>';
  html += '<div class="txt">' + (m.text ? esc(m.text) : '') + '</div>';

  if (m.media && m.media.type !== 'other') {
    html += '<div class="msg-media">';
    if (m.mediaUrl) {
      html += mediaHtml(m.media, m.mediaUrl);
    } else {
      html += '<button class="media-load" type="button">⤓ Загрузить ' + mediaKindName(m.media.type) + '</button>';
    }
    html += '</div>';
  }

  html += '<div class="meta">';
  if (m.deleted) html += '<span class="badge badge-del">УДАЛЕНО</span>';
  if (m.editDate) html += '<span class="badge badge-edit" title="Показать историю правок">ИЗМЕНЕНО</span>';
  if (m.media && m.media.ttl) html += '<span class="badge badge-once">ОДНОРАЗОВОЕ</span>';
  html += '<span class="time">' + timeStr(m.date) + '</span>';
  html += '</div>';

  el.innerHTML = html;

  const loadBtn = el.querySelector('.media-load');
  if (loadBtn) {
    loadBtn.addEventListener('click', () => {
      loadBtn.textContent = 'Загрузка…';
      loadBtn.disabled = true;
      socket.emit('media:get', { chatKey: state.currentChat, msgId: m.id });
    });
  }
  const editBadge = el.querySelector('.badge-edit');
  if (editBadge) {
    editBadge.addEventListener('click', () => showEdits(m));
  }

  state.msgs.set(m.id, el);
  return el;
}

function mediaHtml(media, url) {
  switch (media.type) {
    case 'photo':
    case 'image':
    case 'sticker':
      return '<img alt="медиа" loading="lazy" src="' + url + '">';
    case 'video':
    case 'video-round':
      return '<video controls preload="metadata" src="' + url + '"></video>';
    case 'voice':
      return '<audio controls preload="metadata" src="' + url + '"></audio>';
    case 'audio':
      return '<audio controls preload="metadata" src="' + url + '"></audio>';
    default:
      return '<a class="media-file" href="' + url + '" target="_blank" rel="noopener">⤓ ' +
        esc(media.name || 'файл') + '</a>';
  }
}

function mediaEl(media, url) {
  const t = document.createElement('template');
  t.innerHTML = mediaHtml(media, url).trim();
  return t.content.firstChild;
}

function mediaKindName(t) {
  return ({ photo: 'фото', image: 'изображение', video: 'видео', 'video-round': 'видеокружок', voice: 'голосовое', audio: 'аудио', sticker: 'стикер', file: 'файл' })[t] || 'медиа';
}

function showEdits(m) {
  const modal = $('#modal');
  const body = $('#modal-body');
  let html = '<h3>История правок</h3>';
  const versions = [...(m.edits || []), { text: m.text, date: m.editDate || m.date }];
  html += versions.map((v, i) =>
    '<div class="edit-item"><span class="when">' +
    (i === versions.length - 1 ? 'текущая версия · ' : 'версия ' + (i + 1) + ' · ') +
    new Date(v.date * 1000).toLocaleString('ru-RU') + '</span>' +
    (v.text ? esc(v.text) : '<i>без текста</i>') + '</div>'
  ).join('');
  html += '<button class="modal-close" id="modal-x">Закрыть</button>';
  body.innerHTML = html;
  modal.classList.remove('hidden');
  $('#modal-x').addEventListener('click', () => modal.classList.add('hidden'));
}
$('#modal').addEventListener('click', (e) => {
  if (e.target === $('#modal')) $('#modal').classList.add('hidden');
});

/* =================утилиты================= */
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function cssEsc(s) { return (window.CSS && CSS.escape) ? CSS.escape(s) : s.replace(/["\\:]/g, '\\$&'); }
function timeStr(ts) {
  return new Date(ts * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 3800);
}

/* service worker */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
