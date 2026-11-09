import React from "react";
import { AbsoluteFill } from "remotion";
import { C } from "../theme";

export const Background: React.FC = () => (
  <AbsoluteFill style={{ background: `linear-gradient(180deg, #eef2f6 0%, ${C.bg} 60%)` }}>
    <AbsoluteFill style={{ backgroundImage: "radial-gradient(#0f172a 1.2px, transparent 1.2px)", backgroundSize: "28px 28px", opacity: 0.045 }} />
    <div
      style={{
        position: "absolute",
        left: -260,
        top: -320,
        width: 1000,
        height: 1000,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(15,159,122,.12), rgba(15,159,122,0) 68%)",
      }}
    />
  </AbsoluteFill>
);
