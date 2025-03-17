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
  const [webSocketStatus, setWebSocketStatus] = useState("Not Connected");

  useEffect(() => {
    async function getSTUNAddress() {
      const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS.map(url => ({ urls: url })) });
      
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const ipMatch = event.candidate.candidate.match(/([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/);
          if (ipMatch) {
            setExternalIP(ipMatch[1]);
            logMessage(`STUN Resolved External IP: ${ipMatch[1]}`);
            pc.close();
            connectWebSocket(ipMatch[1]);
          }
        }
      };
      
      await pc.createOffer().then((offer) => pc.setLocalDescription(offer));
    }

    getSTUNAddress();
  }, []);

  function connectWebSocket(ip) {
    logMessage("Attempting WebSocket connection...");
    
    const ws = new WebSocket(WS_SERVER);
    
    ws.onopen = () => {
      setWebSocketStatus("Connected");
      logMessage("WebSocket connection established.");
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
      logMessage("WebSocket connection closed.");
    };
  }

  function logMessage(message) {
    setLogs(prevLogs => [...prevLogs, message]);
  }

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h2>STUN & WebSocket Connection Test</h2>
      <p><strong>External IP:</strong> {externalIP || "Fetching..."}</p>
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
