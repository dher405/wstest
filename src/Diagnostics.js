import React, { useState, useEffect } from "react";
import "./Diagnostics.css";

function Diagnostics() {
    const websocketUrl = "wss://sip131-1111.ringcentral.com:8083/";
    const stunServerUrl = "stun:stun1.eo1.engage.ringcentral.com:19302";
    const networkTestUrl = "https://www.google.com";
    const userId = process.env.REACT_APP_SIP_USER_ID || "803729045020";
    const password = process.env.REACT_APP_SIP_PASSWORD || "j0IM3WpFzs";
    const realm = "sip.ringcentral.com";
    const callId = "test-call-12345";
    const cseq = 1;

    const [results, setResults] = useState({
        networkStatus: "Pending...",
        browserInfo: "Pending...",
        websocketTest: "Pending...",
        javascriptCacheTest: "Pending...",
        performanceTest: "Pending...",
        stunTest: "Pending..."
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

    const md5Hash = async (data) => {
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest("MD5", encoder.encode(data));
        return Array.from(new Uint8Array(hashBuffer))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
    };

    const createAuthResponse = async (nonce) => {
        const ha1 = await md5Hash(`${userId}:${realm}:${password}`);
        const ha2 = await md5Hash("REGISTER:sip.sip.ringcentral.com");
        return await md5Hash(`${ha1}:${nonce}:${ha2}`);
    };

    const testSIPWebSocket = async () => {
        try {
            const ws = new WebSocket(websocketUrl);
            let startTime, latency;
            let messagesReceived = 0;

            ws.onopen = () => {
                startTime = performance.now();
                ws.send(`REGISTER sip:sip.ringcentral.com SIP/2.0\n\n`);
            };

            ws.onmessage = async (event) => {
                messagesReceived++;
                latency = performance.now() - startTime;

                if (event.data.includes("401 Unauthorized")) {
                    const nonceStart = event.data.indexOf('nonce="') + 7;
                    const nonceEnd = event.data.indexOf('"', nonceStart);
                    const nonce = event.data.substring(nonceStart, nonceEnd);
                    const authResponse = await createAuthResponse(nonce);

                    ws.send(
                        `REGISTER sip:sip.ringcentral.com SIP/2.0\nAuthorization: Digest algorithm=MD5, username="${userId}", realm="${realm}", nonce="${nonce}", uri="sip:sip.ringcentral.com", response="${authResponse}"\n\n`
                    );
                } else if (event.data.includes("200 OK")) {
                    setResults((prev) => ({
                        ...prev,
                        websocketTest: `✅ PASS - SIP WebSocket connected and registered successfully.<br><strong>Latency:</strong> ${latency.toFixed(2)} ms`,
                    }));
                } else {
                    setResults((prev) => ({
                        ...prev,
                        websocketTest: `⚠ WARNING - Unexpected WebSocket response.`,
                    }));
                }

                detectBrowserIssues(messagesReceived, latency);
                ws.close();
            };

            ws.onerror = () => {
                setResults((prev) => ({
                    ...prev,
                    websocketTest: "❌ FAIL - WebSocket connection failed.",
                }));
            };
        } catch (error) {
            setResults((prev) => ({
                ...prev,
                websocketTest: `❌ FAIL - WebSocket test error: ${error.message}`,
            }));
        }
    };

    const detectBrowserIssues = (messagesReceived, latency) => {
        if (messagesReceived === 0) {
            setResults((prev) => ({
                ...prev,
                performanceTest: "❌ FAIL - Possible JavaScript execution issue or caching problem. Try clearing cache.",
            }));
        } else if (latency > 2000) {
            setResults((prev) => ({
                ...prev,
                performanceTest: `⚠ WARNING - High WebSocket latency detected (${latency.toFixed(2)} ms). Possible browser performance issue.`,
            }));
        } else {
            setResults((prev) => ({
                ...prev,
                performanceTest: "✅ PASS - Browser performance is normal.",
            }));
        }
    };

    const runTests = async () => {
        setLoading(true);
        setResults({
            networkStatus: "Checking...",
            browserInfo: "Checking...",
            websocketTest: "Checking...",
            javascriptCacheTest: "Checking...",
            performanceTest: "Checking...",
            stunTest: "Checking...",
        });

        await testSIPWebSocket();
        setLoading(false);
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
                    <h3>WebSocket Test</h3>
                    <p dangerouslySetInnerHTML={{ __html: results.websocketTest }}></p>
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
