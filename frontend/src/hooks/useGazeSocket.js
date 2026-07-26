import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api/client";
import { getViewportSize } from "../utils/viewport";

const BACKEND_WS_BASE = import.meta.env.VITE_WS_URL ?? "ws://localhost:8000";
const BACKEND_WS_URL = `${BACKEND_WS_BASE}/ws/gaze/`;
const CV_WS_URL = import.meta.env.VITE_CV_WS_URL ?? "ws://127.0.0.1:8765";

export function useGazeSocket() {
  const [backendConnected, setBackendConnected] = useState(false);
  const [cvConnected, setCvConnected] = useState(false);
  const [gazePoint, setGazePoint] = useState({ x: 0, y: 0 });
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [dwellProgress, setDwellProgress] = useState(0);
  const [shouldClick, setShouldClick] = useState(false);
  const [rawMessage, setRawMessage] = useState(null);
  const [cameraError, setCameraError] = useState("");
  const backendRef = useRef(null);
  const cvRef = useRef(null);

  const sendBackend = useCallback((message) => {
    if (backendRef.current?.readyState !== WebSocket.OPEN) return false;
    backendRef.current.send(JSON.stringify(message));
    return true;
  }, []);

  const sendCv = useCallback((message) => {
    if (cvRef.current?.readyState !== WebSocket.OPEN) return false;
    cvRef.current.send(JSON.stringify(message));
    return true;
  }, []);

  useEffect(() => {
    let disposed = false;
    let backendRetry;
    let cvRetry;

    function connectBackend() {
      const token = localStorage.getItem("access");
      if (!token || disposed) return;
      const socket = new WebSocket(`${BACKEND_WS_URL}?token=${token}`);
      backendRef.current = socket;
      socket.onopen = () => setBackendConnected(true);
      socket.onclose = () => {
        setBackendConnected(false);
        if (!disposed) backendRetry = setTimeout(connectBackend, 2000);
      };
      socket.onerror = () => socket.close();
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Gaze packets originated locally and were already rendered. Django's
          // echo only confirms persistence, so avoid processing each frame twice.
          if (
            data.type === "start_camera" ||
            data.type === "stop_camera" ||
            data.type === "gaze_data"
          )
            return;
        } catch {
          // Ignore malformed backend messages.
        }
      };
    }

    function connectCv() {
      if (disposed) return;
      const socket = new WebSocket(CV_WS_URL);
      cvRef.current = socket;
      socket.onopen = () => setCvConnected(true);
      socket.onclose = () => {
        setCvConnected(false);
        setIsFaceDetected(false);
        if (!disposed) cvRetry = setTimeout(connectCv, 2000);
      };
      socket.onerror = () => socket.close();
      socket.onmessage = (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }
        if (data.type === "camera_error") {
          setCameraError(data.message || "Camera unavailable");
          return;
        }

        setCameraError("");
        setRawMessage(data);
        setIsFaceDetected(!!data.face_detected);
        setIsCalibrated(!!data.calibrated);
        if (data.face_detected) {
          setGazePoint({ x: data.x ?? 0, y: data.y ?? 0 });
          setDwellProgress(data.dwell_progress ?? 0);
          setShouldClick(!!data.should_click);
        }

        // The browser owns the JWT, so it is the authenticated producer of
        // gaze data stored by Django.
        if (backendRef.current?.readyState === WebSocket.OPEN) {
          backendRef.current.send(
            JSON.stringify({ ...data, type: "gaze_data" }),
          );
        }
      };
    }

    connectBackend();
    connectCv();
    return () => {
      disposed = true;
      clearTimeout(backendRetry);
      clearTimeout(cvRetry);
      backendRef.current?.close();
      cvRef.current?.close();
    };
  }, []);

  const startCamera = useCallback(
    async (width, height) => {
      const viewport = getViewportSize();
      const screen_w = width ?? viewport.w;
      const screen_h = height ?? viewport.h;
      let calibration = null;
      try {
        const response = await api.get("/calibration/");
        calibration = response.data.calibrated
          ? response.data.coefficients
          : null;
      } catch {
        calibration = null;
      }
      const backendStarted = sendBackend({
        type: "start_camera",
        screen_w,
        screen_h,
      });
      const cvStarted = sendCv({
        type: "start_camera",
        screen_w,
        screen_h,
        calibration,
      });
      return backendStarted && cvStarted;
    },
    [sendBackend, sendCv],
  );

  const stopCamera = useCallback(() => {
    const backendStopped = sendBackend({ type: "stop_camera" });
    const cvStopped = sendCv({ type: "stop_camera" });
    return backendStopped && cvStopped;
  }, [sendBackend, sendCv]);

  return {
    isConnected: backendConnected && cvConnected,
    backendConnected,
    cvConnected,
    gazePoint,
    isFaceDetected,
    isCalibrated,
    dwellProgress,
    shouldClick,
    rawMessage,
    cameraError,
    startCamera,
    stopCamera,
    sendMessage: sendBackend,
  };
}
