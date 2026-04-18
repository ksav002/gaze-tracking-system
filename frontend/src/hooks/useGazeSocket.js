import { useCallback, useEffect, useRef, useState } from "react";

const WS_BASE = import.meta.env.VITE_WS_URL ?? "ws://localhost:8000";
const WS_URL = `${WS_BASE}/ws/gaze/`;

export function useGazeSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [gazePoint, setGazePoint] = useState({ x: 0, y: 0 });
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [dwellProgress, setDwellProgress] = useState(0);
  const [shouldClick, setShouldClick] = useState(false);
  const [rawMessage, setRawMessage] = useState(null); // ← new

  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  const sendMessage = useCallback((msg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }, []);

  const startCamera = useCallback(
    () => sendMessage({ type: "start_camera" }),
    [sendMessage],
  );
  const stopCamera = useCallback(
    () => sendMessage({ type: "stop_camera" }),
    [sendMessage],
  );

  const connect = useCallback(() => {
    const token = localStorage.getItem("access");
    if (!token) return;

    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setIsFaceDetected(false);
      reconnectRef.current = setTimeout(connect, 2000);
    };

    ws.onerror = () => ws.close();

    ws.onmessage = (e) => {
      let data;
      try {
        data = JSON.parse(e.data);
      } catch {
        return;
      }

      // ignore control echoes
      if (data.type === "start_camera" || data.type === "stop_camera") return;

      // expose raw packet for consumers like Calibration.jsx
      setRawMessage(data);

      setIsFaceDetected(!!data.face_detected);
      setIsCalibrated(!!data.calibrated);

      if (data.face_detected) {
        setGazePoint({ x: data.x ?? 0, y: data.y ?? 0 });
        setDwellProgress(data.dwell_progress ?? 0);
        setShouldClick(!!data.should_click);
      }
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return {
    isConnected,
    gazePoint,
    isFaceDetected,
    isCalibrated,
    dwellProgress,
    shouldClick,
    rawMessage, // ← new
    startCamera,
    stopCamera,
    sendMessage,
  };
}
