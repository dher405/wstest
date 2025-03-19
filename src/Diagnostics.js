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
  const ws = useRef(null);

  const logMessage = (message) => {
    const timestamp = new Date().toISOString();
    setLogs((prevLogs) => [...(prevLogs || []), `[${timestamp}] ${message}`]);
  };

  useEffect(() => {
    const setupDTLS = async () => {
      logMessage("Attempting DTLS handshake before STUN...");
      try {
        const pc = new RTCPeerConnection({
          iceServers: STUN_SERVERS.map((url) => ({ urls: url })),
          dtlsTransportPolicy: "require",
        });
        pc.createDataChannel("test");
        await pc.createOffer().then((offer) => pc.setLocalDescription(offer));
        setDtlsSuccess(true);
        logMessage("DTLS handshake successful.");
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

  const connectWebSocket = (ip, port) => {
    logMessage(`Attempting WebSocket connection to ${WS_SERVER_BASE} from ${ip}:${port}...`);
    const wsUrl = `${WS_SERVER_BASE}?ip=${ip}&port=${port}`;
    ws.current = new WebSocket(wsUrl, "sip");

    ws.current.onopen = () => {
      setWebSocketStatus("Connected");
      logMessage(`✅ WebSocket connection established.`);
      ws.current.send("PING");
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
      <p><strong>External IP:</strong> {externalIP || "Fetching..."}</p>
      <p><strong>External Port:</strong> {externalPort || "Fetching..."}</p>
      <p><strong>STUN Status:</strong> {stunSuccess ? "Success" : "Failed"}</p>
      <p><strong>WebSocket Status:</strong> {webSocketStatus}</p>
      <pre>{logs.length > 0 ? logs.join("\n") : "No logs yet..."}</pre>
    </div>
  );
};

export default STUNWebSocketTest;
