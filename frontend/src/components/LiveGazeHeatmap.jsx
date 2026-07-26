import { useEffect, useRef } from "react";

const LIFETIME_MS = 1400;
const SAMPLE_INTERVAL_MS = 45;
const RADIUS_PX = 115;

export default function LiveGazeHeatmap({ x, y, visible }) {
  const canvasRef = useRef(null);
  const samplesRef = useRef([]);
  const lastSampleRef = useRef(0);

  useEffect(() => {
    if (!visible || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const now = performance.now();
    if (now - lastSampleRef.current < SAMPLE_INTERVAL_MS) return;
    lastSampleRef.current = now;
    samplesRef.current.push({ x, y, createdAt: now });
  }, [x, y, visible]);

  useEffect(() => {
    if (!visible) {
      samplesRef.current = [];
      return undefined;
    }

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    let animationFrame;

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(window.innerWidth * ratio);
      canvas.height = Math.round(window.innerHeight * ratio);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const draw = (now) => {
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      samplesRef.current = samplesRef.current.filter(
        (sample) => now - sample.createdAt < LIFETIME_MS,
      );

      context.globalCompositeOperation = "lighter";
      for (const sample of samplesRef.current) {
        const age = (now - sample.createdAt) / LIFETIME_MS;
        const strength = (1 - age) * 0.13;
        const gradient = context.createRadialGradient(
          sample.x,
          sample.y,
          0,
          sample.x,
          sample.y,
          RADIUS_PX,
        );
        gradient.addColorStop(0, `rgba(255, 55, 25, ${strength})`);
        gradient.addColorStop(0.28, `rgba(255, 190, 35, ${strength * 0.9})`);
        gradient.addColorStop(0.58, `rgba(55, 215, 175, ${strength * 0.55})`);
        gradient.addColorStop(1, "rgba(35, 120, 255, 0)");
        context.fillStyle = gradient;
        context.fillRect(
          sample.x - RADIUS_PX,
          sample.y - RADIUS_PX,
          RADIUS_PX * 2,
          RADIUS_PX * 2,
        );
      }
      context.globalCompositeOperation = "source-over";
      animationFrame = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    animationFrame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      samplesRef.current = [];
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 9999,
      }}
    />
  );
}
