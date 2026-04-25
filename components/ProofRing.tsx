"use client";

import { useEffect, useRef, useState } from "react";
import { Leaf } from "lucide-react";

export function ProofRing({
  value,
  label,
  unit,
}: {
  value: number;
  label: string;
  unit: string;
}) {
  const [animated, setAnimated] = useState(false);
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setAnimated(true);
          obs.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!animated) return;
    const duration = 1200;
    const steps = 60;
    const increment = value / steps;
    let current = 0;
    let frame = 0;
    const interval = setInterval(() => {
      frame++;
      current = Math.min(value, increment * frame);
      setCount(current);
      if (frame >= steps) clearInterval(interval);
    }, duration / steps);
    return () => clearInterval(interval);
  }, [animated, value]);

  const size = 220;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const progress = animated ? 0.78 : 0;
  const dashOffset = circumference * (1 - progress);

  const displayValue =
    count >= 1000
      ? `${(count / 1000).toFixed(1)}`
      : `${count.toFixed(0)}`;
  const displayUnit = count >= 1000 ? "t" : "kg";

  return (
    <div ref={ref} className="proof-ring-wrap">
      {/* Glow behind ring */}
      <div className="proof-ring-glow" />

      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="proof-ring-svg"
      >
        {/* Track */}
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="var(--border-faint)"
          strokeWidth={stroke}
        />
        {/* Progress arc */}
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="var(--brand-green)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${c} ${c})`}
          className="proof-ring-arc"
        />
      </svg>

      {/* Center content */}
      <div className="proof-ring-center">
        <Leaf
          className="proof-ring-leaf"
          style={{ color: "var(--brand-green)" }}
          aria-hidden="true"
        />
        <div className="proof-ring-value tabular-nums">
          {displayValue}
          <span className="proof-ring-unit">{displayUnit}</span>
        </div>
        <div className="proof-ring-label">{unit}</div>
      </div>
    </div>
  );
}

export function CountUp({
  value,
  suffix = "",
  decimals = 0,
}: {
  value: number;
  suffix?: string;
  decimals?: number;
}) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setStarted(true);
          obs.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    const duration = 1000;
    const steps = 50;
    const increment = value / steps;
    let frame = 0;
    const interval = setInterval(() => {
      frame++;
      setCount(Math.min(value, increment * frame));
      if (frame >= steps) clearInterval(interval);
    }, duration / steps);
    return () => clearInterval(interval);
  }, [started, value]);

  return (
    <span ref={ref} className="tabular-nums">
      {count.toFixed(decimals)}
      {suffix}
    </span>
  );
}
