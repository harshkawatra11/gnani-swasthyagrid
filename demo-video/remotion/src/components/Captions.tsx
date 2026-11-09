import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT } from "../theme";

export const Captions: React.FC<{ cues: { from: number; to: number; text: string }[] }> = ({ cues }) => {
  const f = useCurrentFrame();
  const cue = cues.find((c) => f >= c.from && f <= c.to);
  if (!cue) return null;
  const op = Math.min(1, (f - cue.from) / 4, (cue.to - f) / 4);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 986, height: 80, display: "flex", alignItems: "center", justifyContent: "center", opacity: op }}>
      <div style={{ maxWidth: 1560, textAlign: "center", fontFamily: FONT, fontWeight: 500, fontSize: 30, lineHeight: 1.25, color: C.ink }}>{cue.text}</div>
    </div>
  );
};
