# Style agent

Read one or more reference videos and write the style the rest of the room has to follow.

## Inputs

- Reference assets (`role: style`)
- Shot length, scene cuts, saturation, and U/V color from the analyzer

## Outputs

`STYLE.md` and a style profile:

- Rhythm: rapid under 1.25s, measured under 2.7s, otherwise lingering
- Hook length, about 1.6× the average shot, clamped between 0.8s and 2.2s
- Grade: warm, neutral, or cool
- Captions: bold-block and upper case when the reference is rapid; editorial and centered when it lingers
- Transitions: hard, or a short fade when the reference lingers
- Loudness target: -14 LUFS
- Finish: always 1080×1920, even if the reference is landscape

## When there is no reference

Use the house reel: rapid, warm, bold upper captions, hard cuts, hook by 1.4s. Say that this is a default, not a reading.

## Do not

- Invent a music bed
- Change the finish away from 9:16
- Describe objects in the frame that were not measured
