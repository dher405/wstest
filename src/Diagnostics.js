import React, { useState, useEffect, useRef } from "react";

const STUN_SERVERS = [
  "stun:stun1.eo1.engage.ringcentral.com:19302",
  "stun:stun2.eo1.engage.ringcentral.com:19302",
  "stun:stun3.eo1.engage.ringcentral.com:19302",
  "stun:stun.l.google.com:19302"
];

const WS_SERVER_BASE = "wss://sip123-1211.ringcentral.com:8083/";
const SUPPORT_WS_SERVER = "wss://wcm-ev-p02-eo1.engage.ringcentral.com:8080/?access_token=eyJhbGciOiJSUzI1NiJ9...&agent_id=152986&x-engage-client-request-id=EAG:2aafc29d-d611-9341-c8ae-116a83e66db4";

const LOGIN_REQUEST = {
  "@destination": "IQ",
  "@type": "LOGIN-PHASE-1",
  "@message_id": "d6109b8c-3b99-9ab4-80dc-6352e6a50855",
  "response_to": "",
  "reconnect": { "#text": "" },
  "agent_id": { "#text": "152986" },
  "access_token": { "#text": "eyJhbGciOiJSUzI1NiJ9..." }
};

const STUNWebSocketTest = () => {
  const [logs, setLogs] = useState([]);
  const [supportWebSocketStatus, setSupportWebSocketStatus] = useState("Not Connected");
  const [cacheHealth, setCacheHealth] = useState("Checking...");
  const supportWs = useRef(null);

  const logMessage = (message) => {
    const timestamp = new Date().toISOString();
    setLogs((prevLogs) => [...(prevLogs || []), `[${timestamp}] ${message}`]);
  };

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

  const connectSupportWebSocket = () => {
    if (supportWs.current) {
      logMessage("⚠️ WebSocket already attempting to connect or connected.");
      return;
    }
    
    logMessage(`Attempting WebSocket connection to ${SUPPORT_WS_SERVER}...`);
    try {
      supportWs.current = new WebSocket(SUPPORT_WS_SERVER);

      supportWs.current.onopen = () => {
        setSupportWebSocketStatus("Connected");
        logMessage("✅ Support WebSocket connection established.");
        sendLoginRequest();
      };

      supportWs.current.onmessage = (event) => {
        logMessage(`📩 Support WebSocket Response: ${event.data}`);
      };

      supportWs.current.onerror = (error) => {
        setSupportWebSocketStatus("Error");
        logMessage(`❌ Support WebSocket Error: ${error.message}`);
      };

      supportWs.current.onclose = (event) => {
        setSupportWebSocketStatus("Closed");
        logMessage(`🔴 Support WebSocket closed. Code: ${event.code}, Reason: ${event.reason || "No reason provided"}`);
        
        // Auto-reconnect after a delay
        setTimeout(() => {
          logMessage("♻️ Reconnecting WebSocket...");
          supportWs.current = null;
          connectSupportWebSocket();
        }, 5000);
      };
    } catch (error) {
      logMessage(`🚨 WebSocket connection attempt failed: ${error.message}`);
    }
  };

  const sendLoginRequest = () => {
    if (supportWs.current && supportWs.current.readyState === WebSocket.OPEN) {
      const requestString = JSON.stringify(LOGIN_REQUEST);
      supportWs.current.send(requestString);
      logMessage(`📨 Sent UI Login Request: ${requestString}`);
    } else {
      logMessage("⚠️ Support WebSocket not ready, unable to send UI Login Request.");
    }
  };

  useEffect(() => {
    checkCacheHealth();
    connectSupportWebSocket();
    return () => {
      if (supportWs.current) {
        supportWs.current.close();
      }
    };
  }, []);

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h2>Support WebSocket Connection Test</h2>
      <p><strong>Cache Health:</strong> {cacheHealth}</p>
      <p><strong>Support WebSocket Status:</strong> {supportWebSocketStatus}</p>
      <pre>{logs.length > 0 ? logs.join("\n") : "No logs yet..."}</pre>
    </div>
  );
};

export default STUNWebSocketTest;
