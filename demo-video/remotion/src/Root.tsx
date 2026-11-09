import React from "react";
import { Composition } from "remotion";
import { Main } from "./Main";
import tl from "./timeline.json";

export const RemotionRoot: React.FC = () => (
  <Composition id="Demo" component={Main} durationInFrames={tl.totalFrames} fps={tl.fps} width={1920} height={1080} />
);
