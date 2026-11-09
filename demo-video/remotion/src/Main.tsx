import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import "./fonts";
import tl from "./timeline.json";
import { Background } from "./components/Background";
import { FrameSpan, Span } from "./components/FrameSpan";
import { ChapterCard } from "./components/ChapterCard";
import { Captions } from "./components/Captions";
import { MotionClip } from "./components/MotionClip";

export const Main: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#f5f7fa" }}>
    <Background />
    {(tl.spans as Span[]).map((sp) => (
      <Sequence key={sp.id} from={sp.from} durationInFrames={sp.duration} name={sp.id}>
        <FrameSpan span={sp} />
      </Sequence>
    ))}
    {tl.motion.map((m) => (
      <Sequence key={m.id} from={m.from} durationInFrames={m.duration} name={m.id}>
        <MotionClip src={m.src} duration={m.duration} fadeIn={m.fadeIn} fadeOut={m.fadeOut} />
      </Sequence>
    ))}
    {tl.chapters.map((c) => (
      <Sequence key={c.num} from={c.from} durationInFrames={c.duration} name={`chapter-${c.num}`}>
        <ChapterCard num={c.num} name={c.name} line={c.line} duration={c.duration} />
      </Sequence>
    ))}
    <Captions cues={tl.captions} />
    <Audio src={staticFile(tl.audio)} />
  </AbsoluteFill>
);
