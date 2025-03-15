import React, { useState, useEffect } from "react";
import "./Diagnostics.css"; // Import external stylesheet

function Diagnostics() {
    const websocketUrl = "wss://aws80-f01-ccw01.engage.ringcentral.com"; 
    const stunServerUrl = "stun:stun1.eo1.engage.ringcentral.com:19302";
    const networkTestUrl = "https://www.google.com";

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
        window.addEventListener('online', updateNetworkStatus);
        window.addEventListener('offline', updateNetworkStatus);
        updateNetworkStatus();
        return () => {
            window.removeEventListener('online', updateNetworkStatus);
            window.removeEventListener('offline', updateNetworkStatus);
        };
    }, []);

    const updateNetworkStatus = () => {
        setResults(prev => ({
            ...prev,
            networkStatus: navigator.onLine 
                ? `✅ PASS - Connected to the internet<br><strong>Tested URL:</strong> ${networkTestUrl}`
                : `❌ FAIL - No network detected`
        }));
    };

    const runTests = async () => {
        setLoading(true);
        setResults({
            networkStatus: "Checking...",
            browserInfo: "Checking...",
            websocketTest: "Checking...",
            javascriptCacheTest: "Checking...",
            performanceTest: "Checking...",
            stunTest: "Checking..."
        });

        gatherBrowserInfo();
        await testSTUNICE();
        await testWebSocket();
        setLoading(false);
    };

    const gatherBrowserInfo = () => {
        let jsEnabled = typeof window !== 'undefined' ? "✅ PASS - JavaScript is enabled" : "❌ FAIL - JavaScript is disabled";
        let cacheSize = performance.memory ? performance.memory.usedJSHeapSize / 1024 / 1024 : "Unknown";

        setResults(prev => ({
            ...prev,
            browserInfo: `
                <p><strong>JavaScript Status:</strong> ${jsEnabled}</p>
                <p><strong>Browser Cache Usage:</strong> ${cacheSize !== "Unknown" ? cacheSize.toFixed(2) + " MB" : "Unknown"}</p>
            `
        }));

        if (cacheSize !== "Unknown" && cacheSize > 100) {
            setResults(prev => ({
                ...prev,
                javascriptCacheTest: `❌ FAIL - High browser cache detected. Clearing cache may improve performance.`
            }));
        } else {
            setResults(prev => ({
                ...prev,
                javascriptCacheTest: "✅ PASS - Cache usage is within normal limits."
            }));
        }
    };

    const testSTUNICE = async () => {
        try {
            const configuration = { iceServers: [{ urls: stunServerUrl }] };
            const pc = new RTCPeerConnection(configuration);

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    setResults(prev => ({
                        ...prev,
                        stunTest: `✅ PASS - STUN/ICE connected successfully.<br><strong>STUN Server:</strong> ${stunServerUrl}`
                    }));
                } else {
                    setResults(prev => ({
                        ...prev,
                        stunTest: `✅ PASS - ICE gathering complete.<br><strong>STUN Server:</strong> ${stunServerUrl}`
                    }));
                    pc.close();
                }
            };

            pc.createDataChannel('test');
            await pc.createOffer()
                .then((offer) => pc.setLocalDescription(offer))
                .catch((error) => {
                    setResults(prev => ({
                        ...prev,
                        stunTest: `❌ FAIL - STUN/ICE error: ${error}`
                    }));
                });
        } catch (error) {
            setResults(prev => ({
                ...prev,
                stunTest: `❌ FAIL - STUN/ICE test failed: ${error}`
            }));
        }
    };

    const testWebSocket = async () => {
        const ws = new WebSocket(websocketUrl);
        let startTime, latency;
        let messagesReceived = 0;

        ws.onopen = () => {
            startTime = performance.now();
            ws.send('Ping');
        };

        ws.onmessage = (event) => {
            messagesReceived++;
            latency = performance.now() - startTime;

            setResults(prev => ({
                ...prev,
                websocketTest: `✅ PASS - WebSocket connected successfully.<br><strong>WebSocket URL:</strong> ${websocketUrl}<br><strong>Latency:</strong> ${latency.toFixed(2)} ms`
            }));

            detectBrowserIssues(messagesReceived, latency);
            ws.close();
        };

        ws.onerror = () => {
            setResults(prev => ({
                ...prev,
                websocketTest: `❌ FAIL - WebSocket connection failed.<br><strong>WebSocket URL:</strong> ${websocketUrl}<br>Possible network block or firewall issue.`
            }));
        };

        ws.onclose = () => {
            if (messagesReceived === 0) {
                detectBrowserIssues(messagesReceived, latency);
            }
        };
    };

    const detectBrowserIssues = (messagesReceived, latency) => {
        if (messagesReceived === 0) {
            setResults(prev => ({
                ...prev,
                performanceTest: "❌ FAIL - Possible JavaScript execution issue or caching problem. Try clearing cache."
            }));
        } else if (latency > 2000) {
            setResults(prev => ({
                ...prev,
                performanceTest: `⚠ WARNING - High WebSocket latency detected (${latency.toFixed(2)} ms). Possible browser performance issue.`
            }));
        } else {
            setResults(prev => ({
                ...prev,
                performanceTest: "✅ PASS - Browser performance is normal."
            }));
        }
    };

    return (
        <div>
            <h1>Network & Browser Diagnostics</h1>
            <button onClick={runTests} disabled={loading}>
                {loading ? 'Running Tests...' : 'Run Tests'}
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
                    <p dangerouslySetInnerHTML={{ __html: results.websocketTest }}></p>
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

