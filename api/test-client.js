const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080');

ws.on('open', function open() {
  console.log('Connected to WebSocket server');
  console.log('Sending: ping');
  ws.send(JSON.stringify({ event: 'ping', data: 'hello' }));
});

ws.on('message', function incoming(data) {
  console.log('Received:', data.toString());
  ws.close();
});

ws.on('error', function error(err) {
  console.error('Error:', err);
});
