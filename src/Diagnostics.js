import React, { useState, useEffect, useRef } from "react";

const STUN_SERVERS = [
  "stun:stun1.eo1.engage.ringcentral.com:19302",
  "stun:stun2.eo1.engage.ringcentral.com:19302",
  "stun:stun3.eo1.engage.ringcentral.com:19302",
  "stun:stun.l.google.com:19302"
];

const WS_SERVER_BASE = "wss://wcm-ev-p02-eo1.engage.ringcentral.com:8080/";

const LOGIN_REQUEST = {
  "ui_request": {
    "@destination": "IQ",
    "@type": "LOGIN-PHASE-1",
    "@message_id": "d6109b8c-3b99-9ab4-80dc-6352e6a50855",
    "response_to": "",
    "reconnect": { "#text": "" },
    "agent_id": { "#text": "152986" },
    "access_token": { "#text": "eyJhbGciOiJSUzI1NiJ9..." }
  }
};

const STUNWebSocketTest = () => {
  const [logs, setLogs] = useState([]);
  const [webSocketStatus, setWebSocketStatus] = useState("Not Connected");
  const ws = useRef(null);
  const registerTimestamp = useRef(null);

  const logMessage = (message) => {
    const timestamp = new Date().toISOString();
    setLogs((prevLogs) => [...(prevLogs || []), `[${timestamp}] ${message}`]);
  };

  const connectWebSocket = (ip, port) => {
    logMessage(`Attempting WebSocket connection to ${WS_SERVER_BASE} from ${ip}:${port}...`);
    const wsUrl = `${WS_SERVER_BASE}?ip=${ip}&port=${port}`;
    ws.current = new WebSocket(wsUrl, "sip");

    ws.current.onopen = () => {
      setWebSocketStatus("Connected");
      logMessage("✅ WebSocket connection established.");
      sendLoginRequest();
    };

    ws.current.onmessage = (event) => {
      const receiveTimestamp = performance.now();
      if (registerTimestamp.current) {
        const delay = receiveTimestamp - registerTimestamp.current;
        logMessage(`⏱ REGISTER response delay: ${delay.toFixed(2)} ms`);
      }
      logMessage(`📩 WebSocket Response: ${event.data}`);
    };

    ws.current.onerror = (error) => {
      setWebSocketStatus("Error");
      logMessage(`❌ WebSocket Error: ${error.message}`);
    };

    ws.current.onclose = (event) => {
      setWebSocketStatus("Closed");
      logMessage(`🔴 WebSocket closed. Code: ${event.code}, Reason: ${event.reason || "No reason provided"}`);
    };
  };

  const sendLoginRequest = () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      const registerMessage = JSON.stringify(LOGIN_REQUEST);
      registerTimestamp.current = performance.now();
      ws.current.send(registerMessage);
      logMessage("📨 Sent: LOGIN-PHASE-1 request");
    } else {
      logMessage("⚠️ WebSocket not ready, skipping LOGIN request.");
    }
  };

  useEffect(() => {
    if (!ws.current) {
      connectWebSocket("0.0.0.0", "0000");
    }
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h2>WebSocket Connection Test</h2>
      <p><strong>WebSocket Status:</strong> {webSocketStatus}</p>
      <pre>{logs.length > 0 ? logs.join("\n") : "No logs yet..."}</pre>
    </div>
  );
};

export default STUNWebSocketTest;

