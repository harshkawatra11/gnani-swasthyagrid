import React from "react";
import { useCurrentFrame } from "remotion";
import { ramp } from "../anim";
import { C, FONT } from "../theme";

type R = { x: number; y: number; w: number; h: number };

export const Callout: React.FC<{ from: number; duration: number; rect: R | null; label?: string }> = ({ from, duration, rect, label }) => {
  const f = useCurrentFrame();
  const p = ramp(f, from, duration, 8);
  if (p <= 0 || !rect) return null;
  const pad = 8;
  const x = Math.max(6, rect.x - pad);
  const y = Math.max(6, rect.y - pad);
  const w = Math.min(1914 - x, rect.w + pad * 2);
  const h = Math.min(1074 - y, rect.h + pad * 2);
  const labelAbove = y > 78;
  const ly = labelAbove ? y - 58 : Math.min(1080 - 58, y + h + 12);
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: w,
          height: h,
          border: `3px solid ${C.brand}`,
          borderRadius: 14,
          boxShadow: `0 0 0 8px ${C.brandSoft}`,
          opacity: p,
          transform: `scale(${1.03 - 0.03 * p})`,
        }}
      />
      {label ? (
        <div
          style={{
            position: "absolute",
            left: Math.min(x, 1920 - 620),
            top: ly,
            opacity: p,
            transform: `translateY(${(1 - p) * 8}px)`,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 18px",
            borderRadius: 999,
            background: C.ink,
            color: "#fff",
            fontFamily: FONT,
            fontWeight: 600,
            fontSize: 26,
            whiteSpace: "nowrap",
            boxShadow: "0 10px 30px rgba(15,23,42,.25)",
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: 5, background: C.brand }} />
          {label}
        </div>
      ) : null}
    </>
  );
};
