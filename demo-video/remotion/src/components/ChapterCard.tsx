import React from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";
import { C, FRAME, CHROME_H, FONT, MONO } from "../theme";

export const ChapterCard: React.FC<{ num: string; name: string; line: string; duration: number }> = ({ num, name, line, duration }) => {
  const f = useCurrentFrame();
  const inP = interpolate(f, [0, 14], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const outP = interpolate(f, [duration - 12, duration], [1, 0], { extrapolateLeft: "clamp", easing: Easing.in(Easing.cubic) });
  const p = Math.min(inP, outP);
  return (
    <div
      style={{
        position: "absolute",
        left: FRAME.x + 28,
        top: FRAME.y + CHROME_H + 24,
        opacity: p,
        transform: `translateX(${(1 - p) * -24}px)`,
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "16px 24px",
        borderRadius: 16,
        background: "rgba(15,23,42,0.93)",
        color: "#fff",
        boxShadow: "0 18px 50px rgba(15,23,42,.35)",
      }}
    >
      <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 26, color: C.brand }}>{num}</span>
      <span style={{ width: 1, height: 30, background: "rgba(255,255,255,.25)" }} />
      <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 26, letterSpacing: ".14em", textTransform: "uppercase" }}>{name}</span>
      <span style={{ fontFamily: FONT, fontWeight: 500, fontSize: 24, color: "rgba(255,255,255,.75)" }}>{line}</span>
    </div>
  );
};
