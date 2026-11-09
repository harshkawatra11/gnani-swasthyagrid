import React from "react";
import { C, CHROME_H, MONO } from "../theme";

export const Chrome: React.FC<{ url: string }> = ({ url }) => (
  <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: CHROME_H, background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center" }}>
    <div style={{ display: "flex", gap: 8, marginLeft: 18 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ width: 12, height: 12, borderRadius: 6, background: C.border }} />
      ))}
    </div>
    <div
      style={{
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%)",
        height: 26,
        minWidth: 560,
        padding: "0 16px",
        borderRadius: 8,
        background: C.surface2,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        fontFamily: MONO,
        fontSize: 14,
        color: C.muted,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24">
        <path d="M6 10V7a6 6 0 1 1 12 0v3h1v12H5V10h1Zm2 0h8V7a4 4 0 1 0-8 0v3Z" fill="#98a2b3" />
      </svg>
      {url}
    </div>
  </div>
);
