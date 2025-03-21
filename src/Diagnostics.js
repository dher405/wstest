import React, { useState, useEffect, useRef } from "react";

const STUN_SERVERS = [
  "stun:stun1.eo1.engage.ringcentral.com:19302",
  "stun:stun2.eo1.engage.ringcentral.com:19302",
  "stun:stun3.eo1.engage.ringcentral.com:19302",
  "stun:stun.l.google.com:19302"
];

const WS_SERVER_BASE_SIP = "wss://sip123-1211.ringcentral.com:8083/";
const WS_SERVER_BASE_IQ = "wss://wcm-ev-p02-eo1.engage.ringcentral.com:8080/";

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
  const [externalIP, setExternalIP] = useState(null);
  const [externalPort, setExternalPort] = useState(null);
  const [stunSuccess, setStunSuccess] = useState(false);
  const [dtlsSuccess, setDtlsSuccess] = useState(false);
  const [webSocketStatusSIP, setWebSocketStatusSIP] = useState("Not Connected");
  const [webSocketStatusIQ, setWebSocketStatusIQ] = useState("Not Connected");
  const [latency, setLatency] = useState(null);
  const [registerDelay, setRegisterDelay] = useState(null);
  const [browserInfo, setBrowserInfo] = useState("");
  const [cacheHealth, setCacheHealth] = useState("Checking...");
  const wsSIP = useRef(null);
  const wsIQ = useRef(null);
  const registerTimestampSIP = useRef(null);
  const registerTimestampIQ = useRef(null);
  const [pingLatency, setPingLatency] = useState(null);

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
      if (wsSIP.current) {
        wsSIP.current.close();
      }
      if (wsIQ.current) {
        wsIQ.current.close();
      }
    };
  }, []);

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
      setLatency(end - start);
      logMessage(`DTLS handshake successful. Latency: ${(end - start).toFixed(2)}ms`);
      setupSTUN(pc);
    } catch (error) {
      logMessage(`DTLS handshake failed: ${error.message}`);
    }
  };

  const setupSTUN = async (pc) => {
    logMessage("Attempting to set up STUN connection...");
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const ipMatch = event.candidate.candidate.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
        const portMatch = event.candidate.candidate.match(/(\d+)$/);
        if (ipMatch && portMatch) {
          const ip = ipMatch[1];
          const port = parseInt(portMatch[1]);
          logMessage(`STUN Resolved External IP: ${ip}, Port: ${port}`);
          setExternalIP(ip);
          setExternalPort(port);
          setStunSuccess(true);
          setTimeout(() => {
            connectWebSocketSIP(ip, port);
          }, 100);
          pc.close();
        }
      }
    };
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

  const connectWebSocketSIP = (ip, port) => {
    logMessage(`Attempting SIP WebSocket connection to ${WS_SERVER_BASE_SIP}?ip=${ip}&port=${port}...`);
    const wsUrl = `${WS_SERVER_BASE_SIP}?ip=${ip}&port=${port}`;
    wsSIP.current = new WebSocket(wsUrl, "sip");

    wsSIP.current.onopen = () => {
      setWebSocketStatusSIP("Connected");
      logMessage(`✅ SIP WebSocket connection established.`);

      setTimeout(() => {
        if (wsSIP.current && wsSIP.current.readyState === WebSocket.OPEN) {
          const registerMessage =
            "REGISTER sip:server.com SIP/2.0\r\n" +
            "Via: SIP/2.0/WSS client.invalid;branch=z9hG4bK776asdhds\r\n" +
            "Max-Forwards: 70\r\n" +
            "To: <sip:server.com>\r\n" +
            "From: <sip:user@server.com>;tag=49583\r\n" +
            "Call-ID: 1234567890@client.invalid\r\n" +
            "CSeq: 1 REGISTER\r\n" +
            "Contact: <sip:user@server.com>\r\n" +
            "Expires: 600\r\n" +
            "Content-Length: 0\r\n\r\n";
          registerTimestampSIP.current = performance.now();
          wsSIP.current.send(registerMessage);
          logMessage("📨 Sent: SIP REGISTER request");
          sendPingSIP();
          setTimeout(() => {
            if (wsSIP.current) {
              wsSIP.current.close();
              setWebSocketStatusSIP("Closed (after 5s)");
              logMessage(`🔴 SIP WebSocket closed after 5 seconds.`);
              connectWebSocketIQ("0.0.0.0", "0000"); // Move to IQ after SIP closes
            }
          }, 5000);
        } else {
          logMessage("⚠️ SIP WebSocket not ready, skipping REGISTER request.");
        }
      }, 500);
    };

    wsSIP.current.onmessage = (event) => {
      const receiveTimestamp = performance.now();
      if (registerTimestampSIP.current) {
        const delay = receiveTimestamp - registerTimestampSIP.current;
        setRegisterDelay(delay);
        logMessage(`⏱ SIP REGISTER response delay: ${delay.toFixed(2)} ms`);
      }
      if (event.data !== "pong") {
        logMessage(`📩 SIP WebSocket Response: ${event.data}`);
      }
    };

    wsSIP.current.onerror = (error) => {
      setWebSocketStatusSIP("Error");
      logMessage(`❌ SIP WebSocket Error: ${error.message}`);
    };

    wsSIP.current.onclose = (event) => {
      setWebSocketStatusSIP("Closed");
      logMessage(`🔴 SIP WebSocket closed. Code: ${event.code}, Reason: ${event.reason || "No reason provided"}`);
    };
  };

  const sendPingSIP = () => {
    if (wsSIP.current && wsSIP.current.readyState === WebSocket.OPEN) {
      const pingStart = performance.now();
      wsSIP.current.send("ping");
      wsSIP.current.onmessage = (event) => {
        if (event.data === "pong") {
            const pingEnd = performance.now();
            const pingTime = pingEnd - pingStart;
            setPingLatency(pingTime.toFixed(2));
            logMessage(`⏱ SIP Ping latency: ${pingTime.toFixed(2)} ms`);
            setTimeout(sendPingSIP, 2000);
          } else {
            const receiveTimestamp = performance.now();
            if (registerTimestampSIP.current) {
              const delay = receiveTimestamp - registerTimestampSIP.current;
              setRegisterDelay(delay);
              logMessage(`⏱ SIP REGISTER response delay: ${delay.toFixed(2)} ms`);
            }
            logMessage(`📩 SIP WebSocket Response: ${event.data}`);
          }
        };
      }
    };

  const connectWebSocketIQ = (ip, port) => {
    logMessage(`Attempting IQ WebSocket connection to ${WS_SERVER_BASE_IQ}...`);
    wsIQ.current = new WebSocket(WS_SERVER_BASE_IQ);

    wsIQ.current.onopen = () => {
      setWebSocketStatusIQ("Connected");
      logMessage(`✅ IQ WebSocket connection established.`);
      sendLoginRequest();
      setTimeout(() => {
        if (wsIQ.current) {
          wsIQ.current.close();
          setWebSocketStatusIQ("Closed (after 5s)");
          logMessage(`🔴 IQ WebSocket closed after 5 seconds.`);
        }
      }, 5000);
    };

    wsIQ.current.onmessage = (event) => {
      const receiveTimestamp = performance.now();
      if (registerTimestampIQ.current) {
        const delay = receiveTimestamp - registerTimestampIQ.current;
        logMessage(`⏱ IQ LOGIN response delay: ${delay.toFixed(2)} ms`);
      }
      logMessage(`📩 IQ WebSocket Response: ${event.data}`);
    };

    wsIQ.current.onerror = (error) => {
      setWebSocketStatusIQ("Error");
      logMessage(`❌ IQ WebSocket Error: ${error.message}`);
    };

    wsIQ.current.onclose = (event) => {
      setWebSocketStatusIQ("Closed");
      logMessage(`🔴 IQ WebSocket closed. Code: ${event.code}, Reason: ${event.reason || "No reason provided"}`);
    };
  };

  const sendLoginRequest = () => {
    if (wsIQ.current && wsIQ.current.readyState === WebSocket.OPEN) {
      const loginMessage = JSON.stringify(LOGIN_REQUEST);
      registerTimestampIQ.current = performance.now();
      wsIQ.current.send(loginMessage);
      logMessage("📨 Sent: IQ LOGIN-PHASE-1 request");
    } else {
      logMessage("⚠️ IQ WebSocket not ready, skipping LOGIN request.");
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h2>DTLS, STUN & WebSocket Connection Test</h2>
      <p><strong>DTLS Status:</strong> {dtlsSuccess ? "Success" : "Failed"}</p>
      <p><strong>Latency:</strong> {latency ? `${latency.toFixed(2)} ms` : "Measuring..."}</p>
      <p><strong>External IP:</strong> {externalIP || "Fetching..."}</p>
      <p><strong>External Port:</strong> {externalPort || "Fetching..."}</p>
      <p><strong>STUN Status:</strong> {stunSuccess ? "Success" : "Failed"}</p>
      <p><strong>SIP WebSocket Status:</strong> {webSocketStatusSIP}</p>
      <p><strong>IQ WebSocket Status:</strong> {webSocketStatusIQ}</p>
      <p><strong>REGISTER Response Delay:</strong> {registerDelay ? `${registerDelay.toFixed(2)} ms` : "Waiting..."}</p>
      <p><strong>Browser Info:</strong> {browserInfo}</p>
      <p><strong>Cache Health:</strong> {cacheHealth}</p>
      <pre>{logs.length > 0 ? logs.join("\n") : "No logs yet..."}</pre>
    </div>
  );
};

export default STUNWebSocketTest;
