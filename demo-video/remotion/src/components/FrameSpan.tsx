import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, Easing } from "remotion";
import { C, FRAME, CHROME_H, CONTENT_H, SCALE } from "../theme";
import { Chrome } from "./Chrome";
import { ClipLayer, Clip } from "./ClipLayer";

export type Span = { id: string; from: number; duration: number; urls: { from: number; text: string }[]; clips: Clip[] };

export const FrameSpan: React.FC<{ span: Span }> = ({ span }) => {
  const f = useCurrentFrame();
  const enter = interpolate(f, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const exit = interpolate(f, [span.duration - 14, span.duration], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
  const v = Math.min(enter, exit);
  const url = [...span.urls].reverse().find((u) => u.from <= f)?.text ?? span.urls[0]?.text ?? "";
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: FRAME.x,
          top: FRAME.y,
          width: FRAME.w,
          height: FRAME.h,
          borderRadius: 14,
          overflow: "hidden",
          background: C.surface,
          border: `1px solid ${C.border}`,
          boxShadow: "0 40px 100px rgba(15,23,42,.16), 0 10px 30px rgba(15,23,42,.08)",
          opacity: v,
          transform: `translateY(${(1 - v) * 40}px) scale(${0.97 + 0.03 * v})`,
        }}
      >
        <Chrome url={url} />
        <div style={{ position: "absolute", left: 0, top: CHROME_H, width: FRAME.w, height: CONTENT_H, overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, transform: `scale(${SCALE})`, transformOrigin: "0 0" }}>
            {span.clips.map((c) => (
              <Sequence key={c.id} from={c.from} durationInFrames={c.duration} name={c.id}>
                <ClipLayer clip={c} />
              </Sequence>
            ))}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
