// server.js
// Run: npm install express ws
const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

// serve static files from this folder (index.html, styles.css, app.js)
app.use(express.static(path.join(__dirname)));

// fallback
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const server = http.createServer(app);

// Create WebSocket server on same http server at path /ws
const wss = new WebSocket.Server({ server, path: '/ws' });

// maintain simple chat history (last 100 messages)
const history = [];

wss.on('connection', (ws, req) => {
  console.log('Client connected', req.socket.remoteAddress);

  // send history
  ws.send(JSON.stringify({ type: 'history', items: history }));

  ws.on('message', (raw) => {
    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      console.warn('Bad JSON', raw);
      return;
    }

    if (data.type === 'join') {
      const sys = { type: 'system', text: `${data.name} joined.`, time: Date.now() };
      broadcast(JSON.stringify(sys));
    } else if (data.type === 'message') {
      const msg = { type: 'message', name: data.name, text: data.text, time: data.time || Date.now() };
      // keep history
      history.push({ name: msg.name, text: msg.text, time: msg.time });
      if (history.length > 100) history.shift();
      broadcast(JSON.stringify(msg));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    // Optionally broadcast leave message (no reliable name here)
  });
});

function broadcast(data) {
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
