import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, interpolate } from "remotion";

export const MotionClip: React.FC<{ src: string; duration: number; fadeIn: number; fadeOut: number }> = ({ src, duration, fadeIn, fadeOut }) => {
  const f = useCurrentFrame();
  const a = fadeIn ? interpolate(f, [0, fadeIn], [0, 1], { extrapolateRight: "clamp" }) : 1;
  const b = fadeOut ? interpolate(f, [duration - fadeOut, duration], [1, 0], { extrapolateLeft: "clamp" }) : 1;
  return (
    <AbsoluteFill style={{ opacity: Math.min(a, b) }}>
      <OffthreadVideo src={staticFile(src)} muted />
    </AbsoluteFill>
  );
};
