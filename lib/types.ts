export type Platform = "instagram" | "tiktok" | "both";

export type AssetRole = "style" | "footage";

export type CutRhythm = "rapid" | "measured" | "lingering";

export type CaptionStyle = "bold-block" | "minimal" | "editorial";

export type GradeName = "warm" | "neutral" | "cool";

export type TransitionName = "hard" | "fade";

export type BeatRole = "hook" | "context" | "turn" | "proof" | "payoff" | "cta";

export type SceneMark = {
  time: number;
  score: number;
};

export type AssetMetrics = {
  scenes: SceneMark[];
  avgShot: number;
  shotCount: number;
  energy: number[];
  yavg: number | null;
  satavg: number | null;
  uavg: number | null;
  vavg: number | null;
};

export type Asset = {
  id: string;
  role: AssetRole;
  name: string;
  description: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  thumbCount: number;
  metrics?: AssetMetrics;
};

export type StyleProfile = {
  name: string;
  cutRhythm: CutRhythm;
  avgShotSec: number;
  hookSec: number;
  grade: GradeName;
  contrast: number;
  saturation: number;
  vignette: boolean;
  captions: CaptionStyle;
  captionCase: "upper" | "sentence";
  captionPosition: "lower" | "center";
  transitions: TransitionName;
  targetLufs: number;
  notes: string[];
  sourceAssetIds: string[];
};

export type Beat = {
  id: string;
  role: BeatRole;
  voiceover: string;
  onScreenText: string;
  visualNote: string;
  durationSec: number;
};

export type Script = {
  title: string;
  logline: string;
  platform: Platform;
  targetDuration: number;
  tone: "direct" | "playful" | "quiet";
  avoid: string[];
  beats: Beat[];
};

export type ChatMessage = {
  id: string;
  role: "user" | "agent";
  text: string;
  at: string;
};

export type Select = {
  id: string;
  assetId: string;
  inSec: number;
  outSec: number;
  score: number;
  reason: string;
  used: boolean;
};

export type TimelineClip = {
  id: string;
  assetId: string;
  inSec: number;
  outSec: number;
  caption: string;
  beatId?: string;
  muted: boolean;
};

export type ConformNote = {
  id: string;
  severity: "fix" | "note";
  text: string;
  applied: boolean;
};

export type ConformReport = {
  pass: boolean;
  notes: ConformNote[];
  checkedAt: string;
  suggested: TimelineClip[] | null;
};

export type RenderArtifact = {
  id: string;
  createdAt: string;
  duration: number;
  width: number;
  height: number;
  label: string;
};

export type LogLine = {
  id: string;
  agent: string;
  text: string;
  at: string;
};

export type Project = {
  id: string;
  title: string;
  brief: string;
  platform: Platform;
  targetDuration: number;
  sample: boolean;
  createdAt: string;
  updatedAt: string;
  assets: Asset[];
  style: StyleProfile | null;
  styleMd: string;
  script: Script | null;
  scriptMd: string;
  messages: ChatMessage[];
  selects: Select[];
  selectsMd: string;
  timeline: TimelineClip[];
  timelinePast: TimelineClip[][];
  conform: ConformReport | null;
  conformMd: string;
  renders: RenderArtifact[];
  log: LogLine[];
};

export type FootageNote = {
  name: string;
  description: string;
  duration: number;
};
