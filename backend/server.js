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

// ========== API STUBS (for when you paste the next files) ==========
// Placeholder so the API_BASE in the frontend has something to hit.
// Replace these with real EcoCash Zimbabwe integration routes later.
app.get('/api/status', (req, res) => {
  res.json({ ok: true, region: 'ZW', provider: 'EcoCash' });
});

// ========== 404 ==========
app.use((req, res) => {
  res.status(404).send('Not found');
});

// ========== START ==========
app.listen(PORT, '0.0.0.0', () => {
  console.log(`EcoCash Zimbabwe backend running on port ${PORT}`);
});
