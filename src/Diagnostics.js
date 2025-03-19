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
    // Capture Browser & OS Information
    const userAgent = navigator.userAgent;
    setBrowserInfo(userAgent);
    logMessage(`Browser Info: ${userAgent}`);

    // Check browser cache health
    checkCacheHealth();

    const setupDTLS = async () => {
      logMessage("Attempting DTLS handshake before STUN...");
      try {
        const start = performance.now();
        const pc = new RTCPeerConnection({
          iceServers: STUN_SERVERS.map((url) => ({ urls: url })),
          dtlsTransportPolicy: "require",
        });
        pc.createDataChannel("test");
        await pc.createOffer().then((offer) => pc.setLocalDescription(offer));
        setDtlsSuccess(true);
        const end = performance.now();
        const dtlsLatency = end - start;
        setLatency(dtlsLatency);
        logMessage(`DTLS handshake successful. Latency: ${dtlsLatency.toFixed(2)}ms`);
        if (dtlsLatency > 1000) {
          logMessage("⚠️ Possible network delay detected during DTLS handshake.");
        }
        setupSTUN(pc);
      } catch (error) {
        logMessage(`DTLS handshake failed: ${error.message}`);
      }
    };

    const setupSTUN = async (pc) => {
      logMessage("Attempting to set up STUN connection...");
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const ipMatch = event.candidate.candidate.match(
            /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/
          );
          const portMatch = event.candidate.candidate.match(/(\d+)$/);
          if (ipMatch && portMatch) {
            const ip = ipMatch[1];
            const port = parseInt(portMatch[1]);
            logMessage(`STUN Resolved External IP: ${ip}, Port: ${port}`);
            setExternalIP(ip);
            setExternalPort(port);
            setStunSuccess(true);
            setTimeout(() => {
              connectWebSocket(ip, port);
            }, 100);
            pc.close();
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
    };

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
