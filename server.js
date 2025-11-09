const express = require('express');
const path = require('path');
const fs = require('fs');
const { customAlphabet } = require('nanoid');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// nanoid para código verify
const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 6);

// Helpers para leer/escribir data.json
function readData() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '[]');
  } catch (e) {
    return [];
  }
}
function writeData(arr) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(arr, null, 2));
}

// Endpoint: genera frase y crea petición pendiente
app.post('/api/generate', (req, res) => {
  const { username } = req.body || {};
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ ok: false, error: 'username_required' });
  }
  const clean = username.trim();
  const code = nanoid();
  const phrase = `💎 | Intercambia tus objetos de juegos por Robux en MM2 Trades | ${clean} | verify-${code}`;
  const id = `${Date.now()}-${code}`;

  const data = readData();
  const item = {
    id,
    username: clean,
    phrase,
    status: 'pendiente', // pendiente / verificado / rechazado
    adminNote: '',
    createdAt: new Date().toISOString()
  };
  data.push(item);
  writeData(data);

  return res.json({ ok: true, id, phrase, status: item.status });
});

// Endpoint: obtener petición por id (para usuario)
app.get('/api/request/:id', (req, res) => {
  const { id } = req.params;
  const data = readData();
  const item = data.find(d => d.id === id);
  if (!item) return res.status(404).json({ ok: false, error: 'not_found' });
  return res.json({ ok: true, item });
});

// Endpoint: listar todas (para admin)
app.get('/api/requests', (req, res) => {
  const data = readData();
  // devolver orden invertido (más nuevo primero)
  data.sort((a,b) => (b.createdAt > a.createdAt ? 1 : -1));
  return res.json({ ok: true, items: data });
});

// Endpoint: admin decide (approve/reject)
app.post('/api/admin/decision', (req, res) => {
  const { id, action, note } = req.body || {};
  if (!id || !action) return res.status(400).json({ ok: false, error: 'invalid' });

  const data = readData();
  const item = data.find(d => d.id === id);
  if (!item) return res.status(404).json({ ok: false, error: 'not_found' });

  if (action === 'approve') {
    item.status = 'verificado';
    item.adminNote = note || '';
  } else if (action === 'reject') {
    item.status = 'rechazado';
    item.adminNote = note || 'Según nuestro admin no pusiste el mensaje en tu bio';
  } else {
    return res.status(400).json({ ok: false, error: 'unknown_action' });
  }

  writeData(data);
  return res.json({ ok: true, item });
});

// endpoint simple health
app.get('/api/ping', (req,res) => res.json({ ok: true }));

// fallback para SPA (opcional)
app.get('*', (req,res) => {
  // permite servir archivos estáticos desde /public
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
});
