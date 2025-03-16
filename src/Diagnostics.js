import React, { useState, useEffect } from "react";
import "./Diagnostics.css";

function Diagnostics() {
  const websocketUrl = "wss://sip131-1111.ringcentral.com:8083/";
  const stunServerUrl = "stun:stun1.eo1.engage.ringcentral.com:19302";
  const networkTestUrl = "https://www.google.com";
  const userId = "803729045020";
  const password = "j0IM3WpFzs";
  const realm = "sip.ringcentral.com";

  const [results, setResults] = useState({
    networkStatus: "Pending...",
    browserInfo: "Pending...",
    testSIPWebSocket: "Pending...",
    javascriptCacheTest: "Pending...",
    performanceTest: "Pending...",
    stunTest: "Pending...",
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    window.addEventListener("online", updateNetworkStatus);
    window.addEventListener("offline", updateNetworkStatus);
    updateNetworkStatus();
    return () => {
      window.removeEventListener("online", updateNetworkStatus);
      window.removeEventListener("offline", updateNetworkStatus);
    };
  }, []);

  const updateNetworkStatus = () => {
    setResults((prev) => ({
      ...prev,
      networkStatus: navigator.onLine
        ? `✅ PASS - Connected to the internet<br><strong>Tested URL:</strong> ${networkTestUrl}`
        : `❌ FAIL - No network detected`,
    }));
  };

  const runTests = async () => {
    setLoading(true);
    setResults({
      networkStatus: "Checking...",
      browserInfo: "Checking...",
      testSIPWebSocket: "Checking...",
      javascriptCacheTest: "Checking...",
      performanceTest: "Checking...",
      stunTest: "Checking...",
    });

    gatherBrowserInfo();
    await testSTUNICE();
    await testSIPWebSocket();
    setLoading(false);
  };

  const gatherBrowserInfo = () => {
    let jsEnabled =
      typeof window !== "undefined"
        ? "✅ PASS - JavaScript is enabled"
        : "❌ FAIL - JavaScript is disabled";
    let cacheSize = performance.memory
      ? performance.memory.usedJSHeapSize / 1024 / 1024
      : "Unknown";

    setResults((prev) => ({
      ...prev,
      browserInfo: `
          <p><strong>JavaScript Status:</strong> ${jsEnabled}</p>
          <p><strong>Browser Cache Usage:</strong> ${
            cacheSize !== "Unknown" ? cacheSize.toFixed(2) + " MB" : "Unknown"
          }</p>
        `,
    }));

    if (cacheSize !== "Unknown" && cacheSize > 100) {
      setResults((prev) => ({
        ...prev,
        javascriptCacheTest: `❌ FAIL - High browser cache detected. Clearing cache may improve performance.`,
      }));
    } else {
      setResults((prev) => ({
        ...prev,
        javascriptCacheTest: "✅ PASS - Cache usage is within normal limits.",
      }));
    }
  };

  const testSTUNICE = async () => {
    try {
      const configuration = { iceServers: [{ urls: stunServerUrl }] };
      const pc = new RTCPeerConnection(configuration);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          setResults((prev) => ({
            ...prev,
            stunTest: `✅ PASS - STUN/ICE connected successfully.<br><strong>STUN Server:</strong> ${stunServerUrl}`,
          }));
        } else {
          setResults((prev) => ({
            ...prev,
            stunTest: `✅ PASS - ICE gathering complete.<br><strong>STUN Server:</strong> ${stunServerUrl}`,
          }));
          pc.close();
        }
      };

      pc.createDataChannel("test");
      await pc
        .createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch((error) => {
          setResults((prev) => ({
            ...prev,
            stunTest: `❌ FAIL - STUN/ICE error: ${error}`,
          }));
        });
    } catch (error) {
      setResults((prev) => ({
        ...prev,
        stunTest: `❌ FAIL - STUN/ICE test failed: ${error}`,
      }));
    }
  };

  const md5Hash = async (data) => {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("MD5", encoder.encode(data));
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  };

  const createAuthResponse = async (nonce) => {
    const ha1 = await md5Hash(`<span class="math-inline">\{userId\}\:</span>{realm}:${password}`);
    const ha2 = await md5Hash("REGISTER:sip.sip.ringcentral.com");
    return await md5Hash(`<span class="math-inline">\{ha1\}\:</span>{nonce}:${ha2}`);
  };

  const testSIPWebSocket = async () => {
    try {
      const ws = new WebSocket(websocketUrl);
      let startTime = performance.now();
      let messagesReceived = 0;

      ws.onopen = () => {
        ws.send(`REGISTER sip:sip.ringcentral.com SIP/2.0\n\n`);
      };

      ws.onmessage = async (event) => {
        messagesReceived++;
        let latency = performance.now() - startTime;

        if (event.data.includes("401 Unauthorized")) {
          const nonceStart = event.data.indexOf('nonce="') + 7;
          const nonceEnd = event.data.indexOf('"', nonceStart);
          const nonce = event.data.substring(nonceStart, nonceEnd);
          const authResponse = await createAuthResponse(nonce);

          ws.send(
            `REGISTER sip:sip.ringcentral.com SIP/2.0\nAuthorization: Digest algorithm=MD5, username="<span class="math-inline">\{userId\}", realm\="</span>{realm}", nonce="<span class="math-inline">\{nonce\}", uri\="sip\:sip\.ringcentral\.com", response\="</span>{authResponse}"\n\n`
          );
        } else if (event.data.includes("200 OK")) {
          setResults((prev) => ({
            ...prev,
            testSIPWebSocket: `✅ PASS - SIP WebSocket connected and registered successfully.<br><strong>Latency:</strong> ${latency.toFixed(
              2
            )} ms`,
          }));
        } else {
          setResults((prev) => ({
            ...prev,
            testSIPWebSocket: `⚠ WARNING - Unexpected WebSocket response.`,
          }));
        }

        detectBrowserIssues(messagesReceived, latency);
        ws.close();
      };

      ws.onerror = () => {
        setResults((prev) => ({
          ...prev,
          testSIPWebSocket: "❌ FAIL - WebSocket connection failed.",
        }));
      };
    } catch (error) {
      setResults((prev) => ({
        ...prev,
        testSIPWebSocket: `❌ FAIL - WebSocket test error: ${error.message}`,
      }));
    }
  };

  const detectBrowserIssues = (messagesReceived, latency) => {
    if (messagesReceived === 0) {
      setResults((prev) => ({
        ...prev,
        performanceTest:
          "❌ FAIL - Possible JavaScript execution issue or caching problem. Try clearing cache.",
      }));
    } else if (latency > 2000) {
      setResults((prev) => ({
        ...prev,
        performanceTest: `⚠ WARNING - High WebSocket latency detected (${latency.toFixed(
          2
        )} ms). Possible browser performance issue.`,
      }));
    } else {
      setResults((prev) => ({
        ...prev,
        performanceTest: "✅ PASS - Browser performance is normal.",
      }));
    }
  };

  return (
    <div>
      <h1>Network & Browser Diagnostics</h1>
      <button onClick={runTests} disabled={loading}>
        {loading ? "Running Tests..." : "Run Tests"}
      </button>
      <div id="results">
        <div className="test-section">
          <h3>Network Status</h3>
          <p dangerouslySetInnerHTML={{ __html: results.networkStatus }}></p>
        </div>
        <div className="test-section">
          <h3>Browser Info</h3>
          <p dangerouslySetInnerHTML={{ __html: results.browserInfo }}></p>
        </div>
        <div className="test-section">
          <h3>WebSocket Test</h3>
          <p dangerouslySetInnerHTML={{ __html: results.testSIPWebSocket }}></p>
        </div>
                <div className="test-section">
                    <h3>STUN/ICE Test</h3>
                    <p dangerouslySetInnerHTML={{ __html: results.stunTest }}></p>
                </div>
                <div className="test-section">
                    <h3>JavaScript & Cache Test</h3>
                    <p dangerouslySetInnerHTML={{ __html: results.javascriptCacheTest }}></p>
                </div>
                <div className="test-section">
                    <h3>Performance Test</h3>
                    <p dangerouslySetInnerHTML={{ __html: results.performanceTest }}></p>
                </div>
            </div>
        </div>
    );
}

export default Diagnostics;
