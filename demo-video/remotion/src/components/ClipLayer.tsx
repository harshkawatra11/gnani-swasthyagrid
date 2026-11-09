import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame } from "remotion";
import { ramp, fade } from "../anim";
import { Callout } from "./Callout";

export type Clip = {
  id: string;
  src: string;
  from: number;
  duration: number;
  trimStart: number;
  fadeIn: number;
  zooms: { from: number; duration: number; scale: number; ox: number; oy: number }[];
  callouts: { id: string; from: number; duration: number; rect: { x: number; y: number; w: number; h: number } | null; label?: string }[];
};

export const ClipLayer: React.FC<{ clip: Clip }> = ({ clip }) => {
  const f = useCurrentFrame();
  const op = clip.fadeIn ? fade(f, 0, clip.fadeIn) : 1;
  let s = 1;
  let ox = 960;
  let oy = 540;
  for (const z of clip.zooms) {
    const p = ramp(f, z.from, z.duration, 16);
    if (p > 0) {
      s = 1 + (z.scale - 1) * p;
      ox = z.ox;
      oy = z.oy;
    }
  }
  return (
    <AbsoluteFill style={{ opacity: op }}>
      <AbsoluteFill style={{ transform: `scale(${s})`, transformOrigin: `${ox}px ${oy}px` }}>
        <OffthreadVideo src={staticFile(clip.src)} trimBefore={clip.trimStart} muted style={{ width: 1920, height: 1080 }} />
        {clip.callouts.map((c) => (
          <Callout key={c.id} from={c.from} duration={c.duration} rect={c.rect} label={c.label} />
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
