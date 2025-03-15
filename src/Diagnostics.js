import React, { useState, useEffect } from "react";
import "./Diagnostics.css";

function Diagnostics() {
    const websocketUrl = "wss://sip131-1111.ringcentral.com:8083/";
    const stunServerUrl = "stun:stun1.eo1.engage.ringcentral.com:19302";
    const networkTestUrl = "https://www.google.com";
    const userId = "803729045020";
    const password = "j0IM3WpFzs";
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
        await testSIPWebSocket();
        setLoading(false);
    };

    const testSIPWebSocket = async () => {
        try {
            const ws = new WebSocket(websocketUrl);
            ws.onopen = () => {
                ws.send("Ping");
            };

            ws.onmessage = (event) => {
                setResults(prev => ({
                    ...prev,
                    websocketTest: `✅ PASS - WebSocket connected successfully.<br><strong>WebSocket URL:</strong> ${websocketUrl}`
                }));
                ws.close();
            };

            ws.onerror = () => {
                setResults(prev => ({
                    ...prev,
                    websocketTest: `❌ FAIL - WebSocket connection failed.<br><strong>WebSocket URL:</strong> ${websocketUrl}`
                }));
            };
        } catch (error) {
            setResults(prev => ({
                ...prev,
                websocketTest: `❌ FAIL - WebSocket test error: ${error.message}`
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
