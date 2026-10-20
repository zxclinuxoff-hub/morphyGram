/*
 * MorphyGram — Telegram web client (Express + GramJS + Socket.IO)
 *
 * Архитектура:
 *  - MTProto-соединение держит СЕРВЕР (GramJS), фронтенд общается с ним по Socket.IO.
 *  - Сессии живут ТОЛЬКО в оперативной памяти (clientsByToken). На диск ничего
 *    не пишется: перезапуск сервера = выход из всех аккаунтов.
 *  - Анти-удаление: сервер кэширует сообщения и при UpdateDeleteMessages / UpdateDeleteChannelMessages
 *    помечает их "deleted", сохраняя содержимое.
 *  - История правок: при UpdateEdit* предыдущий текст уходит в msg.edits.
 *  - Одноразовые медиа (ttlSeconds) скачиваются на сервер сразу при получении.
 *
 * ЗАЩИТНЫЕ РАМКИ (намеренно, не баги):
 *  - Нет никакой админ-панели, списка сессий, переключения между аккаунтами.
 *  - Токен сессии выдаётся только в ответ на реальный вход (номер + код [+ 2FA])
 *    и хранится в localStorage браузера владельца аккаунта.
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');
const bigInt = require('big-integer');
const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');

const PORT = process.env.PORT || 3000;
const API_ID = parseInt(process.env.API_ID || '38101489', 10);
const API_HASH = process.env.API_HASH || 'bbebd5bef6dd4fe90189ba4b5dd5d8d9';
const IDLE_TTL_MS = 3 * 60 * 60 * 1000; // сессия умирает после 3ч бездействия

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e8 });

const MEDIA_DIR = path.join(os.tmpdir(), 'morphygram-media');
fs.mkdirSync(MEDIA_DIR, { recursive: true });

app.use(express.static(path.join(__dirname, 'public')));
app.get('/app', (req, res) => res.sendFile(path.join(__dirname, 'public', 'app.html')));
app.use('/media', express.static(MEDIA_DIR, { maxAge: '1d', immutable: true }));

/* ---------------- реестры (только RAM) ---------------- */
const clientsByToken = new Map(); // token -> rec

function newRec(client) {
  return {
    client,
    cache: new Map(),  // chatKey -> { messages: Map<id, msg> }
    peers: new Map(),  // chatKey -> InputPeer
    chatInfo: new Map(), // chatKey -> { title, type }
    last: Date.now(),
  };
}

/* ---------------- утилиты ---------------- */
function peerKey(peer) {
  if (!peer) return null;
  const raw = peer.userId !== undefined ? peer.userId
    : peer.chatId !== undefined ? peer.chatId
    : peer.channelId !== undefined ? peer.channelId : null;
  if (raw === null || raw === undefined) return null;
  return peer.className + ':' + raw.toString();
}

function entityKey(e) {
  if (!e) return null;
  if (e.className === 'User') return 'PeerUser:' + e.id.toString();
  if (e.className === 'Channel') return 'PeerChannel:' + e.id.toString();
  if (e.className === 'Chat') return 'PeerChat:' + e.id.toString();
  return null;
}

function entityTitle(e) {
  if (!e) return 'Без названия';
  if (e.title) return e.title;
  const name = [e.firstName, e.lastName].filter(Boolean).join(' ').trim();
  return name || e.username || 'Без названия';
}

function mediaInfo(m) {
  const md = m.media;
  if (!md) return null;
  if (md instanceof Api.MessageMediaPhoto) {
    return { type: 'photo', ttl: !!(md.ttlSeconds && Number(md.ttlSeconds) > 0) };
  }
  if (md instanceof Api.MessageMediaDocument) {
    const doc = md.document;
    let kind = 'file', name = 'file', mime = 'application/octet-stream';
    if (doc instanceof Api.Document) {
      mime = doc.mimeType || mime;
      for (const a of doc.attributes || []) {
        if (a.className === 'DocumentAttributeFilename' && a.fileName) name = a.fileName;
        if (a.className === 'DocumentAttributeVideo') kind = a.roundMessage ? 'video-round' : 'video';
        if (a.className === 'DocumentAttributeAudio') kind = a.voice ? 'voice' : 'audio';
        if (a.className === 'DocumentAttributeSticker') kind = 'sticker';
      }
      if (mime.startsWith('image/') && kind === 'file') kind = 'image';
    }
    return { type: kind, name, mime, ttl: !!(md.ttlSeconds && Number(md.ttlSeconds) > 0) };
  }
  if (md instanceof Api.MessageMediaWebPage) return null;
  if (md.className === 'MessageMediaEmpty') return null;
  return { type: 'other', ttl: false };
}

const EXT_MAP = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
  'video/mp4': '.mp4', 'audio/ogg': '.ogg', 'audio/mpeg': '.mp3',
  'application/pdf': '.pdf',
};

function extFrom(mi) {
  const mime = (mi && mi.mime) || '';
  if (EXT_MAP[mime]) return EXT_MAP[mime];
  if (mime.startsWith('image/')) return '.img';
  if (mime.startsWith('video/')) return '.vid';
  if (mime.startsWith('audio/')) return '.aud';
  return '.bin';
}

async function cacheMediaFile(rec, m) {
  try {
    if (m.media instanceof Api.MessageMediaDocument && m.media.document instanceof Api.Document) {
      const size = Number(m.media.document.size || 0);
      if (size > 60 * 1024 * 1024) return null; // слишком тяжёлое — не тащим
    }
    const buf = await rec.client.downloadMedia(m, {});
    if (!buf) return null;
    const name = crypto.randomBytes(16).toString('hex') + extFrom(mediaInfo(m));
    fs.writeFileSync(path.join(MEDIA_DIR, name), buf);
    return '/media/' + name;
  } catch (_) {
    return null;
  }
}

function baseMsg(rec, m) {
  const fk = peerKey(m.fromId);
  const from = fk && rec.chatInfo.has(fk) ? rec.chatInfo.get(fk).title : '';
  return {
    id: m.id,
    chatKey: peerKey(m.peerId),
    text: m.message || '',
    date: m.date || 0,
    out: !!m.out,
    from,
    editDate: m.editDate ? m.editDate : null,
    deleted: false,
    edits: [],
    media: mediaInfo(m),
    mediaUrl: null,
  };
}

async function meInfo(rec) {
  try {
    const me = await rec.client.getMe();
    return {
      name: entityTitle(me),
      phone: me.phone || '',
      username: me.username || null,
    };
  } catch (_) {
    return { name: 'Я', phone: '', username: null };
  }
}

function friendly(e) {
  const msg = (e && (e.errorMessage || e.message)) || String(e);
  const map = [
    ['PHONE_NUMBER_INVALID', 'Некорректный номер телефона'],
    ['PHONE_CODE_INVALID', 'Неверный код'],
    ['PHONE_CODE_EXPIRED', 'Код истёк — начните вход заново'],
    ['PHONE_NUMBER_UNFEEED', 'Номер не зарегистрирован в Telegram'],
    ['PHONE_NUMBER_BANNED', 'Номер заблокирован в Telegram'],
    ['SESSION_PASSWORD_NEEDED', 'Требуется облачный пароль (2FA)'],
    ['PASSWORD_HASH_INVALID', 'Неверный облачный пароль'],
    ['FLOOD_WAIT', 'Слишком много попыток — подождите: '],
    ['AUTH_RESTART', 'Авторизация перезапущена — попробуйте ещё раз'],
    ['AUTH_KEY_UNREGISTERED', 'Сессия недействительна — войдите заново'],
  ];
  for (const [k, v] of map) {
    if (msg.includes(k)) return v + (k === 'FLOOD_WAIT' ? msg : '');
  }
  return 'Ошибка: ' + msg;
}

/* ---------------- обработчики апдейтов (анти-удаление и пр.) ---------------- */
function attachHandlers(rec, token) {
  rec.client.addEventHandler(async (upd) => {
    rec.last = Date.now();
    try {
      // новое сообщение
      if (upd instanceof Api.UpdateNewMessage || upd instanceof Api.UpdateNewChannelMessage) {
        const m = upd.message;
        if (!(m instanceof Api.Message)) return;
        const key = peerKey(m.peerId);
        if (!key) return;
        const msg = baseMsg(rec, m);
        if (msg.media && msg.media.ttl) msg.mediaUrl = await cacheMediaFile(rec, m);
        const chat = rec.cache.get(key);
        if (chat) chat.messages.set(m.id, msg);
        io.to(token).emit('update:message', { chatKey: key, msg });
        return;
      }
      // правка сообщения -> сохраняем предыдущие версии
      if (upd instanceof Api.UpdateEditMessage || upd instanceof Api.UpdateEditChannelMessage) {
        const m = upd.message;
        if (!(m instanceof Api.Message)) return;
        const key = peerKey(m.peerId);
        const chat = key && rec.cache.get(key);
        const msg = chat && chat.messages.get(m.id);
        if (msg) {
          msg.edits.push({ text: msg.text, date: msg.editDate || msg.date });
          msg.text = m.message || '';
          msg.editDate = m.editDate || Math.floor(Date.now() / 1000);
          msg.deleted = false;
          io.to(token).emit('update:edited', { chatKey: key, msg });
        }
        return;
      }
      // удаление (лички/группы): апдейт несёт только id — ищем по всему кэшу
      if (upd instanceof Api.UpdateDeleteMessages) {
        for (const [key, chat] of rec.cache) {
          for (const id of upd.messages) {
            const msg = chat.messages.get(id);
            if (msg && !msg.deleted) {
              msg.deleted = true;
              io.to(token).emit('update:deleted', { chatKey: key, id });
            }
          }
        }
        return;
      }
      // удаление в канале/супергруппе
      if (upd instanceof Api.UpdateDeleteChannelMessages) {
        const key = 'PeerChannel:' + upd.channelId.toString();
        const chat = rec.cache.get(key);
        if (chat) {
          for (const id of upd.messages) {
            const msg = chat.messages.get(id);
            if (msg && !msg.deleted) {
              msg.deleted = true;
              io.to(token).emit('update:deleted', { chatKey: key, id });
            }
          }
        }
        return;
      }
    } catch (_) { /* тихая смена: апдейты не должны ронять процесс */ }
  });
}

/* ---------------- Socket.IO ---------------- */
io.on('connection', (socket) => {
  let token = null;
  let rec = null;
  const waiters = {};

  const ask = (type) => new Promise((resolve) => {
    waiters[type] = resolve;
    socket.emit('auth:need_' + type);
  });

  socket.on('auth:phone', async ({ phone }) => {
    const clean = String(phone || '').replace(/[^\d+]/g, '');
    if (!clean || clean.length < 8) return socket.emit('auth:error', 'Введите номер в международном формате');
    let client;
    try {
      socket.emit('auth:status', 'Соединение с Telegram…');
      client = new TelegramClient(new StringSession(''), API_ID, API_HASH, {
        connectionRetries: 5,
        deviceModel: 'MorphyGram',
        systemVersion: 'Web 1.0',
        appVersion: '1.0',
        useWSS: true,
      });
      try { client.logger.setLevel('error'); } catch (_) {}
      await client.start({
        phoneNumber: async () => clean,
        phoneCode: async () => await ask('code'),
        password: async () => await ask('password'),
        onError: (err) => socket.emit('auth:error', friendly(err)),
      });
      token = crypto.randomBytes(24).toString('hex');
      rec = newRec(client);
      rec.last = Date.now();
      clientsByToken.set(token, rec);
      attachHandlers(rec, token);
      socket.join(token);
      socket.emit('auth:ok', { token, me: await meInfo(rec) });
    } catch (e) {
      try { if (client) await client.disconnect(); } catch (_) {}
      socket.emit('auth:failed', friendly(e));
    }
  });

  socket.on('auth:code', ({ code }) => {
    if (waiters.code) { waiters.code(String(code || '').replace(/\D/g, '')); delete waiters.code; }
  });
  socket.on('auth:password', ({ password }) => {
    if (waiters.password) { waiters.password(String(password || '')); delete waiters.password; }
  });

  socket.on('auth:resume', async ({ token: t }) => {
    const r = t && clientsByToken.get(t);
    if (!r) return socket.emit('auth:expired');
    token = t; rec = r;
    r.last = Date.now();
    socket.join(t);
    socket.emit('auth:ok', { token: t, me: await meInfo(r) });
  });

  socket.on('dialogs:list', async () => {
    if (!rec) return socket.emit('app:error', 'Нет активной сессии');
    try {
      rec.last = Date.now();
      const dialogs = await rec.client.getDialogs({ limit: 60 });
      const list = [];
      for (const d of dialogs) {
        const e = d.entity;
        if (!e) continue;
        const key = entityKey(e);
        if (!key) continue;
        const type = e.className === 'User' ? (e.bot ? 'bot' : 'user')
          : e.className === 'Channel' ? (e.megagroup ? 'group' : 'channel') : 'group';
        let input = null;
        try { input = await rec.client.getInputEntity(e); } catch (_) {}
        if (input) rec.peers.set(key, input);
        rec.chatInfo.set(key, { title: entityTitle(e), type });
        if (!rec.cache.has(key)) rec.cache.set(key, { messages: new Map() });
        const lastMsg = d.message ? {
          text: (d.message.message || '').slice(0, 140),
          date: d.message.date || 0,
        } : null;
        list.push({
          key, title: entityTitle(e), type,
          unread: (d.dialog && d.dialog.unreadCount) || 0,
          last: lastMsg,
        });
      }
      socket.emit('dialogs', { list });
      // аватарки — лениво, в фоне, первые 40
      (async () => {
        for (const d of dialogs.slice(0, 40)) {
          try {
            const key = entityKey(d.entity);
            const buf = await rec.client.downloadProfilePhoto(d.entity);
            if (buf && key) {
              socket.emit('dialog:avatar', { key, data: 'data:image/jpeg;base64,' + buf.toString('base64') });
            }
          } catch (_) {}
        }
      })();
    } catch (e) {
      socket.emit('app:error', friendly(e));
    }
  });

  socket.on('messages:load', async ({ chatKey }) => {
    if (!rec) return socket.emit('app:error', 'Нет активной сессии');
    try {
      rec.last = Date.now();
      let input = rec.peers.get(chatKey);
      if (!input) {
        const raw = chatKey.split(':')[1];
        try { input = await rec.client.getInputEntity(bigInt(raw)); } catch (_) {}
      }
      if (!input) return socket.emit('app:error', 'Чат не найден — обновите список диалогов');
      rec.peers.set(chatKey, input);
      const msgs = await rec.client.getMessages(input, { limit: 60 });
      let chat = rec.cache.get(chatKey);
      if (!chat) { chat = { messages: new Map() }; rec.cache.set(chatKey, chat); }
      const list = [];
      for (const m of msgs) {
        if (!(m instanceof Api.Message)) continue;
        const msg = baseMsg(rec, m);
        msg._raw = m; // для докачки медиа по запросу
        if (msg.media && msg.media.ttl) msg.mediaUrl = await cacheMediaFile(rec, m);
        chat.messages.set(m.id, msg);
        list.push(msg);
      }
      const wire = list.map(({ _raw, ...rest }) => rest);
      socket.emit('messages', { chatKey, list: wire });
    } catch (e) {
      socket.emit('app:error', friendly(e));
    }
  });

  socket.on('media:get', async ({ chatKey, msgId }) => {
    if (!rec) return;
    try {
      rec.last = Date.now();
      const chat = rec.cache.get(chatKey);
      const msg = chat && chat.messages.get(msgId);
      if (msg && msg.mediaUrl) return socket.emit('media', { chatKey, msgId, url: msg.mediaUrl });
      let input = rec.peers.get(chatKey);
      if (!input) return socket.emit('app:error', 'Медиа недоступно');
      let raw = msg && msg._raw;
      if (!raw) {
        const got = await rec.client.getMessages(input, { ids: [msgId] });
        raw = got && got[0];
      }
      if (!raw || !raw.media) return socket.emit('app:error', 'Медиа недоступно');
      const url = await cacheMediaFile(rec, raw);
      if (!url) return socket.emit('app:error', 'Не удалось загрузить медиа');
      if (msg) msg.mediaUrl = url;
      socket.emit('media', { chatKey, msgId, url });
    } catch (e) {
      socket.emit('app:error', friendly(e));
    }
  });

  socket.on('message:send', async ({ chatKey, text }) => {
    if (!rec || !text) return;
    try {
      rec.last = Date.now();
      const input = rec.peers.get(chatKey);
      if (!input) return socket.emit('app:error', 'Чат не найден');
      await rec.client.sendMessage(input, { message: String(text).slice(0, 4000) });
    } catch (e) {
      socket.emit('app:error', friendly(e));
    }
  });

  socket.on('logout', async () => {
    if (rec) { try { await rec.client.disconnect(); } catch (_) {} }
    if (token) clientsByToken.delete(token);
    rec = null; token = null;
    socket.emit('auth:expired');
  });

  socket.on('disconnect', () => {
    // сессию сохраняем — страница могла просто обновиться; подчистит idle-таймер
  });
});

/* ---------------- уборщик неактивных сессий ---------------- */
setInterval(() => {
  const now = Date.now();
  for (const [t, r] of clientsByToken) {
    if (now - r.last > IDLE_TTL_MS) {
      try { r.client.disconnect(); } catch (_) {}
      clientsByToken.delete(t);
      console.log('[morphygram] idle session dropped:', t.slice(0, 8) + '…');
    }
  }
}, 15 * 60 * 1000);

server.listen(PORT, '0.0.0.0', () => {
  console.log('[morphygram] night shift started on port ' + PORT);
});
