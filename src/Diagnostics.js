import React, { useState, useEffect, useRef } from "react";

const STUN_SERVERS = [
  "stun:stun1.eo1.engage.ringcentral.com:19302",
  "stun:stun2.eo1.engage.ringcentral.com:19302",
  "stun:stun3.eo1.engage.ringcentral.com:19302",
  "stun:stun.l.google.com:19302"
];

const WS_SERVER_BASE = "wss://sip123-1211.ringcentral.com:8083/";

const STUNWebSocketTest = () => {
  const [logs, setLogs] = useState([]);
  const [externalIP, setExternalIP] = useState(null);
  const [externalPort, setExternalPort] = useState(null);
  const [stunSuccess, setStunSuccess] = useState(false);
  const [dtlsSuccess, setDtlsSuccess] = useState(false);
  const [webSocketStatus, setWebSocketStatus] = useState("Not Connected");
  const [latency, setLatency] = useState(null);
  const [browserInfo, setBrowserInfo] = useState("");
  const [cacheHealth, setCacheHealth] = useState("Checking...");
  const ws = useRef(null);

  const logMessage = (message) => {
    const timestamp = new Date().toISOString();
    setLogs((prevLogs) => [...(prevLogs || []), `[${timestamp}] ${message}`]);
  };

  useEffect(() => {
    const userAgent = navigator.userAgent;
    setBrowserInfo(userAgent);
    logMessage(`Browser Info: ${userAgent}`);
    checkCacheHealth();
    setupDTLS();
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  const checkCacheHealth = () => {
    caches.keys().then((cacheNames) => {
      if (cacheNames.length > 0) {
        logMessage(`⚠️ Browser cache detected (${cacheNames.length} cache entries). This may contribute to delays.`);
        setCacheHealth("Cache detected, may cause delays.");
      } else {
        logMessage("✅ No significant browser cache detected.");
        setCacheHealth("Cache is clear, no detected issues.");
      }
    });
  };

  const connectWebSocket = (ip, port) => {
    logMessage(`Attempting WebSocket connection to ${WS_SERVER_BASE} from ${ip}:${port}...`);
    const wsUrl = `${WS_SERVER_BASE}?ip=${ip}&port=${port}`;
    ws.current = new WebSocket(wsUrl, "sip");

    ws.current.onopen = () => {
      setWebSocketStatus("Connected");
      logMessage(`✅ WebSocket connection established.`);
      setTimeout(() => {
        if (ws.current.readyState === WebSocket.OPEN) {
          const registerMessage = "REGISTER sip:server.com SIP/2.0\r\nVia: SIP/2.0/WSS client.invalid;branch=z9hG4bK776asdhds\r\nMax-Forwards: 70\r\nTo: <sip:server.com>\r\nFrom: <sip:user@server.com>;tag=49583\r\nCall-ID: 1234567890@client.invalid\r\nCSeq: 1 REGISTER\r\nContact: <sip:user@server.com>\r\nExpires: 600\r\nContent-Length: 0\r\n\r\n";
          ws.current.send(registerMessage);
          logMessage("📨 Sent: REGISTER request");
        } else {
          logMessage("⚠️ WebSocket not ready, skipping REGISTER request.");
        }
      }, 500);
    };

    ws.current.onmessage = (event) => {
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

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h2>DTLS, STUN & WebSocket Connection Test</h2>
      <p><strong>DTLS Status:</strong> {dtlsSuccess ? "Success" : "Failed"}</p>
      <p><strong>Latency:</strong> {latency ? `${latency.toFixed(2)} ms` : "Measuring..."}</p>
      <p><strong>External IP:</strong> {externalIP || "Fetching..."}</p>
      <p><strong>External Port:</strong> {externalPort || "Fetching..."}</p>
      <p><strong>STUN Status:</strong> {stunSuccess ? "Success" : "Failed"}</p>
      <p><strong>WebSocket Status:</strong> {webSocketStatus}</p>
      <p><strong>Browser Info:</strong> {browserInfo}</p>
      <p><strong>Cache Health:</strong> {cacheHealth}</p>
      <pre>{logs.length > 0 ? logs.join("\n") : "No logs yet..."}</pre>
    </div>
  );
};

export default STUNWebSocketTest;
