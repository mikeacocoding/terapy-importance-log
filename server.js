const express = require('express');
const path = require('path');
const os = require('os');
const { ensureData, readDoc, writeDoc } = require('./src/db');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => res.setHeader('Cache-Control', 'no-store'),
}));

app.get('/api/data', async (req, res) => {
  res.json(await readDoc());
});

app.put('/api/data', async (req, res) => {
  const doc = req.body;
  if (!doc || !Array.isArray(doc.days)) {
    return res.status(400).json({ error: 'documento inválido' });
  }
  await writeDoc(doc);
  res.status(204).end();
});

function getLocalIPs() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

async function start() {
  await ensureData();
  app.listen(PORT, HOST, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    const ips = getLocalIPs();
    if (ips.length) {
      console.log('Accesible desde el celular en la misma red WiFi:');
      ips.forEach((ip) => console.log(`  http://${ip}:${PORT}`));
    } else {
      console.log('No se detecto una IP de red local.');
    }
  });
}

start();
