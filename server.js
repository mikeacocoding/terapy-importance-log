const express = require('express');
const path = require('path');
const os = require('os');
const { ensureData } = require('./src/db');
const daysRouter = require('./src/routes/days');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/days', daysRouter);

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
