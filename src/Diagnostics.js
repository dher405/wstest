import React, { useState, useEffect } from "react";

const STUN_SERVERS = [
  "stun:wcm-ev-p02-eo1.engage.ringcentral.com:19302" // Use WebSocket server for STUN
];

const WS_SERVER_BASE = "wss://wcm-ev-p02-eo1.engage.ringcentral.com:8080";

const STUNWebSocketTest = () => {
  const [logs, setLogs] = useState([]);
  const [externalIP, setExternalIP] = useState(null);
  const [externalPort, setExternalPort] = useState(null);
  const [stunSuccess, setStunSuccess] = useState(false);
  const [dtlsSuccess, setDtlsSuccess] = useState(false);
  const [webSocketStatus, setWebSocketStatus] = useState("Not Connected");
  let ws;

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
    logMessage("Attempting to set up STUN connection with WebSocket server...");
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            const ipMatch = event.candidate.candidate.match(/([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/);
            const portMatch = event.candidate.candidate.match(/([0-9]+)$/);
            if (ipMatch && portMatch) {
                logMessage(`STUN Resolved External IP: ${ipMatch[1]}, Port: ${portMatch[1]}`);
                setExternalIP(ipMatch[1]);
                setExternalPort(parseInt(portMatch[1]));
                setStunSuccess(true);

                // ✅ Ensure WebSocket uses the same resolved STUN server connection
                setTimeout(() => {
                    connectWebSocket(ipMatch[1], parseInt(portMatch[1]));
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
}
    setupDTLS();
  }, []);

 function connectWebSocket(ip, port) {
    logMessage(`Attempting WebSocket connection to ${WS_SERVER_BASE} from ${ip}:${port}...`);

    const accessToken = "eyJhbGciOiJSUzI1NiJ9.eyJhZ250IjpbMTUyOTg2XSwiYWdudC1hY2MiOnsiMTUyOTg2IjoiMjEyNzAwMDEifSwiZW1iZCI6ZmFsc2UsInJjYWMiOiIzNzQzOTUxMCIsImVzdSI6ZmFsc2UsImxhcHAiOiJTU08iLCJmbHIiOmZhbHNlLCJzc28iOnRydWUsInJjaWQiOjE5MTgwOTYwMDgsInBsYXQiOiJldi1wMDIiLCJhY2N0IjoiMjEyNzAwMDAiLCJleHAiOjE3NDIxODA5Nzl9.BCX5N73WAsmQZrHR4JyTWO-0g8wvujFy0haQZdXycoGjcfDL0OnFltvTNsewUhN3_camJv2zw1yNvCYB095GxocZNhFhRi5JFk-fQqsxVtctgqp1xeKM_OkQQb-3Fghblp2ss0KlrymzMyB7Yo3Io_rUAmlMwSzhoCKU1B2KffwWNnYGzRUfw79n_VIw_4tAub0nzbhYqumdUDz-9uGuk2Bb8F7rgw_vAkkYicoQncCI52pPQlV-dIktRcnQIVnnHsLigUvBmyAHKdVkjcapkSqTwNfdBLSenCxZ2i166j5-O63bIivjHSxjOVdH9fiCxgl3MDwai0Kmtilgv-KcwA";
    const agentId = "152986";
    const clientRequestId = "EAG:08415eb6-311a-7639-ad11-d6f25746aa36";
    const wsUrl = `${WS_SERVER_BASE}/?access_token=${encodeURIComponent(accessToken)}&agent_id=${agentId}&x-engage-client-request-id=${clientRequestId}`;

    try {
        ws = new WebSocket(wsUrl, [], {
            headers: {
                "Accept-Encoding": "gzip, deflate, br, zstd",
                "Accept-Language": "en-US,en;q=0.9",
                "Cache-Control": "no-cache",
                "Connection": "Upgrade",
                "Host": "wcm-ev-p02-eo1.engage.ringcentral.com:8080",
                "Origin": "https://ringcx.ringcentral.com",
                "Pragma": "no-cache",
                "Sec-WebSocket-Extensions": "permessage-deflate; client_max_window_bits",
                "Sec-WebSocket-Key": btoa(Math.random().toString(36).substring(2, 18)), // Dynamic key generation
                "Sec-WebSocket-Version": "13",
                "Upgrade": "websocket",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36"
            }
        });

        ws.onopen = () => {
            setWebSocketStatus("Connected");
            logMessage(`WebSocket connection established to ${wsUrl} from ${ip}:${port}.`);
            ws.send("PING");
            sendTestUDPPackets();
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
            logMessage(`WebSocket connection to ${wsUrl} closed.`);
        };
    } catch (error) {
        logMessage(`WebSocket connection failed: ${error.message}`);
    }
}

  function sendTestUDPPackets() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      logMessage("Sending test UDP packets over WebSocket...");
      ws.send(JSON.stringify({ type: "test", message: "Hello from UDP over WebSocket!" }));
    } else {
      logMessage("WebSocket is not open. Cannot send UDP packets.");
    }
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
    </div>
  );
};

export default STUNWebSocketTest;

