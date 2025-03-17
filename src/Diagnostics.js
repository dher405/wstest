import React, { useState, useEffect } from "react";

const STUN_SERVERS = [
  "stun:stun1.eo1.engage.ringcentral.com:19302",
  "stun:stun2.eo1.engage.ringcentral.com:19302",
  "stun:stun3.eo1.engage.ringcentral.com:19302",
  "stun:stun.l.google.com:19302" // Fallback
];

const WS_SERVER = "wss://sip123-1211.ringcentral.com:8083";

const STUNWebSocketTest = () => {
  const [logs, setLogs] = useState([]);
  const [externalIP, setExternalIP] = useState(null);
  const [externalPort, setExternalPort] = useState(null);
  const [stunSuccess, setStunSuccess] = useState(false);
  const [dtlsSuccess, setDtlsSuccess] = useState(false);
  const [webSocketStatus, setWebSocketStatus] = useState("Not Connected");

  useEffect(() => {
    async function setupDTLS() {
      logMessage("Attempting DTLS handshake before STUN...");
      try {
        const pc = new RTCPeerConnection({
          iceServers: STUN_SERVERS.map(url => ({ urls: url })),
          dtlsTransportPolicy: "require"
        });
        pc.createDataChannel("test");
        await pc.createOffer().then((offer) => pc.setLocalDescription(offer));
        setDtlsSuccess(true);
        logMessage("DTLS handshake successful.");
        setupSTUN(pc);
      } catch (error) {
        logMessage(`DTLS handshake failed: ${error.message}`);
      }
    }

    async function setupSTUN(pc) {
      logMessage("Attempting to set up STUN connection...");
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const ipMatch = event.candidate.candidate.match(/([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/);
          const portMatch = event.candidate.candidate.match(/([0-9]+)$/);
          if (ipMatch && portMatch) {
            setExternalIP(ipMatch[1]);
            setExternalPort(parseInt(portMatch[1]));
            setStunSuccess(true);
            logMessage(`STUN Resolved External IP: ${ipMatch[1]}, Port: ${portMatch[1]}`);
            pc.close();
            connectWebSocket(ipMatch[1], parseInt(portMatch[1]));
          }
        }
      };
      
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "failed") {
          setStunSuccess(false);
          logMessage("STUN connection failed.");
          pc.close();
        }
      };
    }

    setupDTLS();
  }, []);

  function connectWebSocket(ip, port) {
    if (!stunSuccess) {
      logMessage("Skipping WebSocket connection as STUN setup failed.");
      return;
    }

    logMessage(`Attempting WebSocket connection to ${WS_SERVER} over STUN-resolved IP: ${ip}:${port}...`);
    
    const ws = new WebSocket(WS_SERVER, [], {
      headers: {
        'Upgrade': 'websocket',
        'Connection': 'Upgrade',
        'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
        'Sec-WebSocket-Version': '13',
        'Origin': 'https://ringcx.ringcentral.com'
      }
    });

    ws.onopen = () => {
      setWebSocketStatus("Connected");
      logMessage(`WebSocket connection established to ${WS_SERVER} from ${ip}:${port}.`);
      ws.send("PING");
    };

    ws.onmessage = (event) => {
      logMessage(`WebSocket Response: ${event.data}`);
    };

    ws.onerror = (error) => {
      setWebSocketStatus("Error");
      logMessage(`WebSocket Error: ${error.message}`);
    };

    ws.onclose = () => {
      setWebSocketStatus("Closed");
      logMessage(`WebSocket connection to ${WS_SERVER} closed.`);
    };
  }

  function logMessage(message) {
    setLogs(prevLogs => [...prevLogs, message]);
  }

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h2>DTLS, STUN & WebSocket Connection Test</h2>
      <p><strong>DTLS Status:</strong> {dtlsSuccess ? "Success" : "Failed"}</p>
      <p><strong>External IP:</strong> {externalIP || "Fetching..."}</p>
      <p><strong>External Port:</strong> {externalPort || "Fetching..."}</p>
      <p><strong>STUN Status:</strong> {stunSuccess ? "Success" : "Failed"}</p>
      <p><strong>WebSocket Status:</strong> {webSocketStatus}</p>
      <h3>Logs:</h3>
      <div style={{ background: "#f4f4f4", padding: "10px", borderRadius: "5px", maxHeight: "200px", overflowY: "auto" }}>
        {logs.map((log, index) => (
          <p key={index} style={{ margin: "5px 0" }}>{log}</p>
        ))}
      </div>
    </div>
  );
};

export default STUNWebSocketTest;


