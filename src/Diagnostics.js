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

        setBrowserInfo(`
            <p><strong>Browser:</strong> ${navigator.userAgent}</p>
            <p><strong>Platform:</strong> ${navigator.platform}</p>
            <p><strong>JavaScript:</strong> ${jsEnabled}</p>
            <p><strong>WebGL Support:</strong> ${webglSupport ? "Yes" : "No"}</p>
            <p><strong>Local Storage:</strong> ${typeof localStorage !== 'undefined' ? "Available" : "Not Available"}</p>
            <p><strong>Cookies Enabled:</strong> ${navigator.cookieEnabled ? "Yes" : "No"}</p>
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
        try {
            const ws = new WebSocket('wss://echo.websocket.events');

            ws.onopen = () => {
                setWebsocketOutput((prev) => prev + '<br>WebSocket connection opened.');
                ws.send('Ping');
            };

            ws.onmessage = (event) => {
                setWebsocketOutput((prev) => prev + `<br>WebSocket message received: ${event.data}`);
                ws.close();
            };

            ws.onerror = (error) => {
                setWebsocketOutput((prev) => prev + `<br>WebSocket error: ${error.message}`);
                fallbackNetworkTest();
            };

            ws.onclose = () => {
                setWebsocketOutput((prev) => prev + '<br>WebSocket connection closed.');
            };
        } catch (error) {
            setWebsocketOutput((prev) => prev + `<br>WebSocket test failed: ${error}`);
            fallbackNetworkTest();
        }
    };

    const fallbackNetworkTest = async () => {
        try {
            const response = await fetch("https://www.google.com", { mode: 'no-cors' });
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

