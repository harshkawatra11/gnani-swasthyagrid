import { interpolate, Easing } from "remotion";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const ramp = (f: number, from: number, dur: number, e: number) => {
  if (f < from || f > from + dur) return 0;
  const up = interpolate(f, [from, from + e], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const down = interpolate(f, [from + dur - e, from + dur], [1, 0], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  return Math.min(up, down);
};

export const fade = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
