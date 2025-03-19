import React, { useState, useEffect, useRef } from "react";

const STUN_SERVERS = [
  "stun:stun1.eo1.engage.ringcentral.com:19302",
  "stun:stun2.eo1.engage.ringcentral.com:19302",
  "stun:stun3.eo1.engage.ringcentral.com:19302",
  "stun:stun.l.google.com:19302" // Fallback
];

const WS_SERVER_BASE = "wss://sip123-1211.ringcentral.com:8083";

const STUNWebSocketTest = () => {
  const [logs, setLogs] = useState();
  const [externalIP, setExternalIP] = useState(null);
  const [externalPort, setExternalPort] = useState(null);
  const [stunSuccess, setStunSuccess] = useState(false);
  const [dtlsSuccess, setDtlsSuccess] = useState(false);
  const [webSocketStatus, setWebSocketStatus] = useState("Not Connected");
  const ws = useRef(null);

  const logMessage = (message) => {
    const timestamp = new Date().toISOString();
    setLogs((prevLogs) => [...prevLogs, `[${timestamp}] ${message}`]);
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
          // Corrected regex for IP address matching
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
            return;
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
      if (window.pc) {
        window.pc.close();
      }
      if (ws.current) {
        ws.current.close();
      }
    };
  },);

  const connectWebSocket = (ip, port) => {
    logMessage(
      `Attempting WebSocket connection to ${WS_SERVER_BASE} from ${ip}:${port}...`
    );

    const accessToken =
      "eyJhbGciOiJSUzI1NiJ9.eyJhZ250IjpbMTUyOTg2XSwiYWdudC1hY2MiOnsiMTUyOTg2IjoiMjEyNzAwMDEifSwiZW1iZCI6ZmFsc2UsInJjYWMiOiIzNzQzOTUxMCIsImVzdSI6ZmFsc2UsImxhcHAiOiJTU08iLCJmbHIiOmZhbHNlLCJzc28iOnRydWUsInJjaWQiOjE5MTgwOTYwMDgsInBsYXQiOiJldi1wMDIiLCJhY2N0IjoiMjEyNzAwMDAiLCJleHAiOjE3NDIxODA5Nzl9.BCX5N73WAsmQZrHR4JyTWO-0g8wvujFy0haQZdXycoGjcfDL0OnFltvTNsewUhN3_camJv2zw1yNvCYB095GxocZNhFhRi5JFk-fQqsxVtctgqp1xeKM_OkQQb-3Fghblp2ss0KlrymzMyB7Yo3Io_rUAmlMwSzhoCKU1B2KffwWNnYGzRUfw79n_VIw_4tAub0nzbhYqumdUDz-9uGuk2Bb8F7rgw_vAkkYicoQncCI52pPQlV-dIktRcnQIVnnHsLigUvBmyAHKdVkjcapkSqTwNfdBLSenCxZ2i166j5-O63bIivjHSxjOVdH9fiCxgl3MDwai0Kmtilgv-KcwA";
    const agentId = "152986";
    const clientRequestId = "EAG:08415eb6-311a-7639-ad11-d6f25746aa36";
    const wsUrl = `${WS_SERVER_BASE}/?access_token=${encodeURIComponent(
      accessToken
    )}&agent_id=${agentId}&x-engage-client-request-id=${clientRequestId}`;

    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      setWebSocketStatus("Connected");
      logMessage(`✅ WebSocket connection established to ${wsUrl} from ${ip}:${port}.`);
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
      logMessage(
        `🔴 WebSocket connection to ${wsUrl} closed. Code: ${event.code}, Reason: ${event.reason}`
      );
    };
  };

  const sendTestUDPPackets = () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      logMessage("Sending test UDP packets over WebSocket...");
      ws.current.send(
        JSON.stringify({ type: "test", message: "Hello from UDP over WebSocket!" })
      );
    } else {
      logMessage("WebSocket is not open. Cannot send UDP packets.");
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h2>DTLS, STUN & WebSocket Connection Test</h2>
      <p>
        <strong>DTLS Status:</strong> {dtlsSuccess ? "Success" : "Failed"}
      </p>
      <p>
        <strong>External IP:</strong> {externalIP || "Fetching..."}
      </p>
      <p>
        <strong>External Port:</strong> {externalPort || "Fetching..."}
      </p>
      <p>
        <strong>STUN Status:</strong> {stunSuccess ? "Success" : "Failed"}
      </p>
      <p>
        <strong>WebSocket Status:</strong> {webSocketStatus}
      </p>
      <button onClick={sendTestUDPPackets} disabled={webSocketStatus !== "Connected"}>
        Send UDP Packets
      </button>
      <pre>{logs.join("\n")}</pre>
    </div>
  );
};

export default STUNWebSocketTest;
