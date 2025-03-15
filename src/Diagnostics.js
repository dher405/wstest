import React, { useState, useEffect } from "react";
import "./Diagnostics.css"; // Import external stylesheet

function Diagnostics() {
    const [browserInfo, setBrowserInfo] = useState('');
    const [stunIceOutput, setStunIceOutput] = useState('');
    const [websocketOutput, setWebsocketOutput] = useState('');
    const [networkStatus, setNetworkStatus] = useState('');
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
        setNetworkStatus(navigator.onLine ? "Connected to the internet" : "Offline: No network connection detected");
    };

    const runTests = async () => {
        setLoading(true);
        setBrowserInfo('Gathering Browser and OS information...');
        setStunIceOutput('Testing STUN/ICE...');
        setWebsocketOutput('Testing WebSocket...');
        setNetworkStatus('Checking network connectivity...');

        gatherBrowserInfo();
        await testSTUNICE();
        await testWebSocket();
        setLoading(false);
    };

    const gatherBrowserInfo = () => {
        let jsEnabled = typeof window !== 'undefined' ? "Enabled" : "Disabled";
        let webglSupport = (() => {
            try {
                return !!window.WebGLRenderingContext;
            } catch (e) {
                return false;
            }
        })();
        let cacheSize = performance.memory ? performance.memory.usedJSHeapSize / 1024 / 1024 : "Unknown";

        setBrowserInfo(`
            <p><strong>Browser:</strong> ${navigator.userAgent}</p>
            <p><strong>Platform:</strong> ${navigator.platform}</p>
            <p><strong>JavaScript:</strong> ${jsEnabled}</p>
            <p><strong>WebGL Support:</strong> ${webglSupport ? "Yes" : "No"}</p>
            <p><strong>Local Storage:</strong> ${typeof localStorage !== 'undefined' ? "Available" : "Not Available"}</p>
            <p><strong>Cookies Enabled:</strong> ${navigator.cookieEnabled ? "Yes" : "No"}</p>
            <p><strong>Browser Cache Usage:</strong> ${cacheSize !== "Unknown" ? cacheSize.toFixed(2) + " MB" : "Unknown"}</p>
        `);
    };

    const testSTUNICE = async () => {
        try {
            const configuration = {
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
            };
            const pc = new RTCPeerConnection(configuration);

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    setStunIceOutput((prev) => prev + `<br>ICE Candidate: ${JSON.stringify(event.candidate)}`);
                } else {
                    setStunIceOutput((prev) => prev + '<br>ICE gathering complete.');
                    pc.close();
                }
            };

            pc.oniceconnectionstatechange = () => {
                setStunIceOutput((prev) => prev + `<br>ICE Connection State: ${pc.iceConnectionState}`);
            };

            pc.createDataChannel('test');
            await pc.createOffer()
                .then((offer) => pc.setLocalDescription(offer))
                .catch((error) => {
                    setStunIceOutput((prev) => prev + `<br>Error creating offer: ${error}`);
                });
        } catch (error) {
            setStunIceOutput((prev) => prev + `<br>STUN/ICE test failed: ${error}`);
        }
    };

    const testWebSocket = async () => {
        const ws = new WebSocket('wss://echo.websocket.events');
        let startTime, latency;
        let messagesReceived = 0;

        ws.onopen = () => {
            setWebsocketOutput((prev) => prev + '<br>WebSocket connection opened.');
            startTime = performance.now();
            ws.send('Ping');
        };

        ws.onmessage = (event) => {
            messagesReceived++;
            latency = performance.now() - startTime;
            setWebsocketOutput((prev) => prev + `<br>WebSocket message received: ${event.data}`);
            setWebsocketOutput((prev) => prev + `<br>Latency: ${latency.toFixed(2)} ms`);
            ws.close();
        };

        ws.onerror = (error) => {
            setWebsocketOutput((prev) => prev + `<br>WebSocket error: ${error.message}`);
            fallbackNetworkTest();
        };

        ws.onclose = () => {
            setWebsocketOutput((prev) => prev + `<br>WebSocket connection closed.`);
            detectBrowserIssues(messagesReceived, latency);
        };
    };

    const detectBrowserIssues = (messagesReceived, latency) => {
        if (messagesReceived === 0) {
            setWebsocketOutput((prev) => prev + "<br>⚠ Possible issue with JavaScript execution or caching. Try clearing the browser cache.");
        } else if (latency > 2000) {
            setWebsocketOutput((prev) => prev + "<br>⚠ High WebSocket latency detected. Browser performance may be affecting real-time communication.");
        }
    };

    const fallbackNetworkTest = async () => {
        try {
            await fetch("https://www.google.com", { mode: 'no-cors' });
            setNetworkStatus("Internet is reachable, but WebSocket is blocked.");
        } catch (error) {
            setNetworkStatus("Network issue detected: No WebSocket and failed HTTP request.");
        }
    };

    return (
        <div>
            <h1>Network Diagnostics</h1>
            <button onClick={runTests} disabled={loading}>
                {loading ? 'Running Tests...' : 'Run Tests'}
            </button>
            <div id="results">
                <div className="test-section" dangerouslySetInnerHTML={{ __html: networkStatus }}></div>
                <div className="test-section" dangerouslySetInnerHTML={{ __html: browserInfo }}></div>
                <div className="test-section" dangerouslySetInnerHTML={{ __html: stunIceOutput }}></div>
                <div className="test-section" dangerouslySetInnerHTML={{ __html: websocketOutput }}></div>
            </div>
        </div>
    );
}

export default Diagnostics;
