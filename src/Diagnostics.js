import React, { useState, useEffect, useRef } from "react";

const STUN_SERVERS = [
  "stun:stun1.eo1.engage.ringcentral.com:19302",
  "stun:stun2.eo1.engage.ringcentral.com:19302",
  "stun:stun3.eo1.engage.ringcentral.com:19302",
  "stun:stun.l.google.com:19302"
];

const WS_SERVER_BASE = "wss://sip123-1211.ringcentral.com:8083/";
const SUPPORT_WS_SERVER = "wss://wcm-ev-p02-eo1.engage.ringcentral.com:8080/?access_token=eyJhbGciOiJSUzI1NiJ9.eyJhZ250IjpbMTUyOTg2XSwiYWdudC1hY2MiOnsiMTUyOTg2IjoiMjEyNzAwMDEifSwiZW1iZCI6ZmFsc2UsInJjYWMiOiIzNzQzOTUxMCIsImVzdSI6ZmFsc2UsImxhcHAiOiJTU08iLCJmbHIiOmZhbHNlLCJzc28iOnRydWUsInJjaWQiOjE5MTgwOTYwMDgsInBsYXQiOiJldi1wMDIiLCJhY2N0IjoiMjEyNzAwMDAiLCJleHAiOjE3NDI0ODY0MTh9.mmxWbUm2kczSW2AM8fs9KNfZJj_YTnRgV6jibwMNoMd179fuaetsGq5EQBPFQ3pkgl0i1RxjMaitiPrErGo9hgje-0_bYVd8N7UMOAG0kLO4twjCZXlfRCGAHKbwMxuumJf-7mK_fllD26xKoDDiAVg0H-wnDr_I4N_bnYs_ikcoW1JbMkgA6cDzxxPjIL48JpXgTdGID9Bry7_kXDi2Tvqmnl9CTw62-KYDYk7dRz2Z2VkzDEU0TjbIUmyz-BEEkILO3q1OvW4Myu9WHFrbwAGUZlpMQOs6GXSyuInoKgomKaY-A2o40XRXgG1I0QnCM-wVKL0SMxNHsVs3bcGg9w&agent_id=152986&x-engage-client-request-id=EAG:2aafc29d-d611-9341-c8ae-116a83e66db4";

const STUNWebSocketTest = () => {
  const [logs, setLogs] = useState([]);
  const [externalIP, setExternalIP] = useState(null);
  const [externalPort, setExternalPort] = useState(null);
  const [stunSuccess, setStunSuccess] = useState(false);
  const [dtlsSuccess, setDtlsSuccess] = useState(false);
  const [webSocketStatus, setWebSocketStatus] = useState("Not Connected");
  const [supportWebSocketStatus, setSupportWebSocketStatus] = useState("Not Connected");
  const [latency, setLatency] = useState(null);
  const [registerDelay, setRegisterDelay] = useState(null);
  const [browserInfo, setBrowserInfo] = useState("");
  const [cacheHealth, setCacheHealth] = useState("Checking...");
  const ws = useRef(null);
  const supportWs = useRef(null);
  const registerTimestamp = useRef(null);

  const logMessage = (message) => {
    const timestamp = new Date().toISOString();
    setLogs((prevLogs) => [...(prevLogs || []), `[${timestamp}] ${message}`]);
  };

  const connectWebSocket = () => {
    logMessage(`Attempting WebSocket connection to ${WS_SERVER_BASE}...`);
    ws.current = new WebSocket(WS_SERVER_BASE, "sip");

    ws.current.onopen = () => {
      setWebSocketStatus("Connected");
      logMessage("✅ WebSocket connection established.");
      
      setTimeout(() => {
        if (ws.current.readyState === WebSocket.OPEN) {
          const registerMessage = "REGISTER sip:server.com SIP/2.0\r\nVia: SIP/2.0/WSS client.invalid;branch=z9hG4bK776asdhds\r\nMax-Forwards: 70\r\nTo: <sip:server.com>\r\nFrom: <sip:user@server.com>;tag=49583\r\nCall-ID: 1234567890@client.invalid\r\nCSeq: 1 REGISTER\r\nContact: <sip:user@server.com>\r\nExpires: 600\r\nContent-Length: 0\r\n\r\n";
          registerTimestamp.current = performance.now();
          ws.current.send(registerMessage);
          logMessage("📨 Sent: REGISTER request");
        } else {
          logMessage("⚠️ WebSocket not ready, skipping REGISTER request.");
        }
      }, 500);
    };

    ws.current.onmessage = (event) => {
      const receiveTimestamp = performance.now();
      if (registerTimestamp.current) {
        const delay = receiveTimestamp - registerTimestamp.current;
        setRegisterDelay(delay);
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

  const connectSupportWebSocket = () => {
    logMessage(`Attempting WebSocket connection to ${SUPPORT_WS_SERVER}...`);
    supportWs.current = new WebSocket(SUPPORT_WS_SERVER);

    supportWs.current.onopen = () => {
      setSupportWebSocketStatus("Connected");
      logMessage("✅ Support WebSocket connection established.");
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
    };
  };

  useEffect(() => {
    connectWebSocket();
    connectSupportWebSocket();
  }, []);

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h2>DTLS, STUN & WebSocket Connection Test</h2>
      <p><strong>WebSocket Status:</strong> {webSocketStatus}</p>
      <p><strong>Support WebSocket Status:</strong> {supportWebSocketStatus}</p>
      <p><strong>REGISTER Response Delay:</strong> {registerDelay ? `${registerDelay.toFixed(2)} ms` : "Waiting..."}</p>
      <pre>{logs.length > 0 ? logs.join("\n") : "No logs yet..."}</pre>
    </div>
  );
};

export default STUNWebSocketTest;
