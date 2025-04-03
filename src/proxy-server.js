import express from 'express';
import http from 'http';
import WebSocket from 'ws';
import url from 'url';
import cors from 'cors';

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

const RINGCENTRAL_IQ_URL = 'wss://wcm-ev-p02-eo1.engage.ringcentral.com:8080/';

app.use(cors());
app.get('/', (_, res) => res.send('WebSocket Proxy Running'));

server.on('upgrade', (req, socket, head) => {
  const pathname = url.parse(req.url).pathname;

  if (pathname === '/iq') {
    wss.handleUpgrade(req, socket, head, (wsClient) => {
      wss.emit('connection', wsClient, req);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (clientSocket, req) => {
  const queryParams = url.parse(req.url, true).query;

  const { access_token, agent_id, x_engage_client_request_id } = queryParams;

  if (!access_token || !agent_id || !x_engage_client_request_id) {
    console.error("Missing query parameters.");
    clientSocket.close();
    return;
  }

  const targetUrl = `${RINGCENTRAL_IQ_
