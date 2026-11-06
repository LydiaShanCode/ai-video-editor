import { uid } from "../ids";
import { card, clamp, sentences, subjectFrom } from "../text";
import type { Beat, BeatRole, FootageNote, Platform, Script } from "../types";

export type ScriptInput = {
  brief: string;
  platform: Platform;
  targetDuration: number;
  footage: FootageNote[];
  tone?: Script["tone"];
};

const COFFEE = /pour|coffee|kettle|steam|morning/i;

export function draftScript(input: ScriptInput): Script {
  const brief = input.brief.trim();
  const footage = [...input.footage];
  const coffee = COFFEE.test(`${brief} ${footage.map((clip) => clip.description).join(" ")}`);
  const hero = pick(footage, ["hero", "pour", "best", "reveal", "goal"]) ?? footage[0];
  const quiet = pick(footage, ["quiet", "still", "empty", "wide", "slow", "window", "light"], hero);
  const texture = pick(footage, ["grind", "noise", "hands", "texture", "rhythm", "messy"], hero);
  const payoff = pick(footage, ["payoff", "sip", "smile", "exhale", "reaction", "laugh"], hero);
  const target = snapDuration(input.targetDuration);
  const roles = rolesFor(target, Boolean(quiet && quiet !== hero), Boolean(texture && texture !== hero));
  const subject = subjectFrom(brief || "the thing the footage keeps circling");
  const title = coffee ? "The pour" : titleFrom(subject);
  const beats = roles.map((role) => {
    const asset = assetFor(role, { hero, quiet, texture, payoff });
    const copy = lineFor(role, { coffee, subject, brief, asset });
    return {
      id: uid("beat"),
      role,
      voiceover: copy.voiceover,
      onScreenText: copy.onScreenText,
      visualNote: asset?.description || copy.visualNote,
      durationSec: 1,
    } satisfies Beat;
  });
  return {
    title,
    logline: coffee
      ? "The only part of the morning worth keeping is the pour."
      : brief || `A ${target} second cut about ${subject}.`,
    platform: input.platform,
    targetDuration: target,
    tone: input.tone ?? "direct",
    avoid: footage
      .filter((clip) => /accidental|mostly nothing|dead air|useless/i.test(`${clip.name} ${clip.description}`))
      .map((clip) => clip.name.toLowerCase()),
    beats: scaleBeats(applyTone(beats, input.tone ?? "direct", coffee), target),
  };
}

export function workshopScript(current: Script | null, input: ScriptInput, message: string) {
  const text = message.trim();
  if (!text || /^(draft|redraft|start over)\b/i.test(text)) {
    const script = draftScript({ ...input, tone: current?.tone });
    return { script, reply: opening(script, input) };
  }

  const script: Script = current
    ? {
        ...current,
        beats: current.beats.map((beat) => ({ ...beat })),
        avoid: [...current.avoid],
      }
    : draftScript(input);
  const notes: string[] = [];
  const lower = text.toLowerCase();
  const quoted = /[“"]([^”"]+)[”"]/.exec(text);

  if (quoted?.[1]) {
    const line = quoted[1].trim();
    const hook = script.beats.find((beat) => beat.role === "hook") ?? script.beats[0];
    if (hook) {
      hook.voiceover = line;
      hook.onScreenText = card(line).toUpperCase();
    }
    notes.push(`Hook line is now “${line}”.`);
  }

  const duration = readDuration(lower);
  if (duration) {
    script.targetDuration = duration;
    script.beats = rebuildRoles(script, input, duration);
    notes.push(`Pulled the outline to ${duration}s.`);
  } else if (/\b(shorter|tighter|too long)\b/.test(lower)) {
    script.targetDuration = snapDuration(Math.max(12, script.targetDuration * 0.65));
    script.beats = rebuildRoles(script, input, script.targetDuration);
    notes.push(`Tightened it to ${script.targetDuration}s.`);
  }

  if (/\b(playful|funny|joke|lighter)\b/.test(lower)) {
    script.tone = "playful";
    script.beats = applyTone(script.beats, "playful", COFFEE.test(input.brief));
    notes.push("Lightened the voice. Same pictures.");
  }
  if (/\b(quiet|calm|cinematic|softer|slower)\b/.test(lower)) {
    script.tone = "quiet";
    script.beats = applyTone(script.beats, "quiet", COFFEE.test(input.brief));
    notes.push("Slowed the writing down. Set the style to lingering if the pictures should breathe, then assemble again.");
  }
  if (/\b(cta|follow|subscribe|save this)\b/.test(lower) && !script.beats.some((beat) => beat.role === "cta")) {
    script.beats.push(ctaBeat(COFFEE.test(input.brief)));
    notes.push("Added a last beat that asks them to save it.");
  }

  const avoided = avoidWords(lower);
  if (avoided.length) {
    script.avoid = unique([...script.avoid, ...avoided]);
    const before = script.beats.length;
    script.beats = script.beats.filter((beat) => !mentions(beat, script.avoid));
    if (!script.beats.length) script.beats = draftScript({ ...input, targetDuration: script.targetDuration }).beats;
    if (script.beats.length !== before) notes.push(`Keeping ${avoided.join(", ")} out of the outline.`);
    else notes.push(`I'll keep ${avoided.join(", ")} off the timeline when this assembles.`);
  }

  if (/\bhook\b/.test(lower) && !quoted) {
    const rest = text.replace(/.*\bhook\b[:\s-]*/i, "").trim();
    const hook = script.beats.find((beat) => beat.role === "hook") ?? script.beats[0];
    if (hook && rest.length > 8) {
      hook.voiceover = rest.replace(/^to\s+/i, "");
      hook.onScreenText = card(rest).toUpperCase();
      notes.push("Rewrote the hook from your note.");
    }
  }

  if (!notes.length) {
    script.logline = text.replace(/\s+/g, " ").slice(0, 180);
    const hook = script.beats.find((beat) => beat.role === "hook") ?? script.beats[0];
    if (hook) {
      hook.voiceover = text.length < 120 ? text : text.slice(0, 116).replace(/\s+\S*$/, "");
      hook.onScreenText = card(text).toUpperCase();
    }
    notes.push("I put your note in the hook and the logline. Name a clip to lose, or tell me the length.");
  }

  script.beats = scaleBeats(script.beats, script.targetDuration);
  script.platform = input.platform;
  return {
    script,
    reply: `${notes.join(" ")} Assemble again when the outline feels right.`,
  };
}

function opening(script: Script, input: ScriptInput) {
  if (!input.brief.trim() && input.footage.every((clip) => !clip.description.trim())) {
    return "I can score motion and loudness, but I can't see the story until you say what this is. Tell me what the footage is about, who it's for, and what should be true by the last frame.";
  }
  const used = new Set(script.beats.map((beat) => beat.visualNote));
  const leftOut = input.footage.filter((clip) => clip.description && !used.has(clip.description));
  const left = leftOut.length ? ` Left out ${leftOut.map((clip) => clip.name).join(", ")}.` : "";
  return `Drafted “${script.title}” at ${script.targetDuration}s, ${script.beats.length} beats.${left} Push the hook, the length, or a clip you don't want.`;
}

function pick(footage: FootageNote[], words: string[], except?: FootageNote) {
  const ranked = footage
    .filter((clip) => clip !== except)
    .map((clip) => ({
      clip,
      score: words.reduce((sum, word) => sum + (clip.description.toLowerCase().includes(word) || clip.name.toLowerCase().includes(word) ? 1 : 0), 0),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.clip;
}

function rolesFor(target: number, hasQuiet: boolean, hasTexture: boolean): BeatRole[] {
  if (target <= 16) return hasQuiet ? ["hook", "context", "payoff"] : ["hook", "turn", "payoff"];
  if (target <= 26) {
    const roles: BeatRole[] = ["hook", "context", "turn", "payoff"];
    if (hasTexture) roles.splice(3, 0, "proof");
    return roles;
  }
  const roles: BeatRole[] = ["hook", "context", "turn", "payoff", "cta"];
  if (hasTexture) roles.splice(3, 0, "proof");
  return roles;
}

function assetFor(
  role: BeatRole,
  cast: { hero?: FootageNote; quiet?: FootageNote; texture?: FootageNote; payoff?: FootageNote },
) {
  if (role === "context") return cast.quiet ?? cast.hero;
  if (role === "proof") return cast.texture ?? cast.hero;
  if (role === "payoff" || role === "cta") return cast.payoff ?? cast.hero;
  return cast.hero;
}

function lineFor(
  role: BeatRole,
  ctx: { coffee: boolean; subject: string; brief: string; asset?: FootageNote },
) {
  if (ctx.coffee) {
    const lines: Record<BeatRole, { voiceover: string; onScreenText: string; visualNote: string }> = {
      hook: { voiceover: "Don't rush the only good part.", onScreenText: "DON'T RUSH THIS", visualNote: "The pour." },
      context: { voiceover: "The table can sit there. The morning hasn't started.", onScreenText: "LET IT SIT", visualNote: "The quiet table." },
      turn: { voiceover: "Then the kettle tips, and that's the whole film.", onScreenText: "THIS IS THE FILM", visualNote: "The pour, again." },
      proof: { voiceover: "The grinder is just noise you got through.", onScreenText: "JUST NOISE", visualNote: "The grinder." },
      payoff: { voiceover: "Sip. Put it down. That's the cut.", onScreenText: "THAT'S THE CUT", visualNote: "The sip." },
      cta: { voiceover: "Save this for the morning you try to skip.", onScreenText: "SAVE THE MORNING", visualNote: "The cup, one last time." },
    };
    return lines[role];
  }
  const extra = sentences(ctx.brief);
  const lines: Record<BeatRole, { voiceover: string; onScreenText: string; visualNote: string }> = {
    hook: {
      voiceover: ctx.subject.length < 80 ? `Don't skip this. ${ctx.subject}.` : extra[0] || "Watch the next cut.",
      onScreenText: card(ctx.subject).toUpperCase(),
      visualNote: "The frame the video is actually about.",
    },
    context: {
      voiceover: extra[1] || "Stay on the quiet part. It earns the next cut.",
      onScreenText: "STAY WITH IT",
      visualNote: "A wider, quieter frame.",
    },
    turn: {
      voiceover: "This is the frame the rest of the video is for.",
      onScreenText: "THIS FRAME",
      visualNote: "The turn.",
    },
    proof: {
      voiceover: "Everything else is just how you got here.",
      onScreenText: "JUST HOW",
      visualNote: "Texture, not the hero.",
    },
    payoff: {
      voiceover: extra.at(-1) || "Hold. Then get out.",
      onScreenText: "HOLD",
      visualNote: "The payoff.",
    },
    cta: {
      voiceover: "Send this to the person who rushes.",
      onScreenText: "SEND THIS",
      visualNote: "One last look.",
    },
  };
  return lines[role];
}

function applyTone(beats: Beat[], tone: Script["tone"], coffee: boolean) {
  if (tone === "direct") return beats;
  return beats.map((beat) => {
    if (tone === "quiet" && beat.role === "hook") {
      return { ...beat, voiceover: coffee ? "Wait for the pour." : "Wait for it.", onScreenText: "WAIT" };
    }
    if (tone === "playful" && beat.role === "hook") {
      return {
        ...beat,
        voiceover: coffee ? "The pour is doing the most. Let it." : "Okay. Look at this.",
        onScreenText: coffee ? "LET IT" : "LOOK",
      };
    }
    return beat;
  });
}

function scaleBeats(beats: Beat[], target: number) {
  if (!beats.length) return beats;
  const weights: Record<BeatRole, number> = {
    hook: 0.14,
    context: 0.2,
    turn: 0.22,
    proof: 0.16,
    payoff: 0.2,
    cta: 0.12,
  };
  const total = beats.reduce((sum, beat) => sum + weights[beat.role], 0);
  let assigned = 0;
  return beats.map((beat, index) => {
    const isLast = index === beats.length - 1;
    const duration = isLast
      ? Math.round((target - assigned) * 10) / 10
      : Math.round(((weights[beat.role] / total) * target) * 10) / 10;
    assigned += duration;
    return { ...beat, durationSec: clamp(duration, 0.8, 12) };
  });
}

function rebuildRoles(script: Script, input: ScriptInput, target: number) {
  const fresh = draftScript({ ...input, targetDuration: target, tone: script.tone });
  const byRole = new Map(script.beats.map((beat) => [beat.role, beat]));
  return fresh.beats.map((beat) => {
    const previous = byRole.get(beat.role);
    if (!previous) return beat;
    return {
      ...beat,
      voiceover: previous.voiceover,
      onScreenText: previous.onScreenText,
      visualNote: previous.visualNote || beat.visualNote,
    };
  });
}

function ctaBeat(coffee: boolean): Beat {
  return {
    id: uid("beat"),
    role: "cta",
    voiceover: coffee ? "Save this for the morning you try to skip." : "Send this to the person who rushes.",
    onScreenText: coffee ? "SAVE THE MORNING" : "SEND THIS",
    visualNote: "One last look.",
    durationSec: 2,
  };
}

function readDuration(lower: string) {
  if (/\b(15|fifteen)\b/.test(lower)) return 15;
  if (/\b(24|twenty-four)\b/.test(lower)) return 24;
  if (/\b(30|thirty)\b/.test(lower)) return 30;
  if (/\b(45|forty-five)\b/.test(lower)) return 45;
  if (/\b(60|sixty|one minute)\b/.test(lower)) return 60;
  return 0;
}

function snapDuration(value: number) {
  const allowed = [15, 24, 30, 45, 60];
  return allowed.reduce((best, next) => (Math.abs(next - value) < Math.abs(best - value) ? next : best));
}

function avoidWords(lower: string) {
  const hits: string[] = [];
  const pattern = /\b(?:lose|drop|remove|skip|without|cut)\s+the\s+([a-z0-9]+)|(?:don't use|do not use)\s+(?:the\s+)?([a-z0-9]+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(lower))) {
    const word = match[1] || match[2] || "";
    if (word.length > 3 && !["clip", "shot", "footage", "part", "rest"].includes(word)) hits.push(word);
  }
  return unique(hits).slice(0, 4);
}

function mentions(beat: Beat, words: string[]) {
  const hay = `${beat.visualNote} ${beat.voiceover} ${beat.onScreenText}`.toLowerCase();
  return words.some((word) => hay.includes(word));
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function titleFrom(subject: string) {
  const words = subject.replace(/[^\w\s]/g, " ").split(/\s+/).filter((word) => word.length > 2).slice(0, 4);
  if (!words.length) return "Untitled cut";
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
