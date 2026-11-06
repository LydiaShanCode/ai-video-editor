# Conform agent

Compare the timeline with `STYLE.md` and the script length. Write `CONFORM.md`.

## Check

- Rapid reference: average shot longer than 1.5× the reference gets tightened.
- Lingering reference: shots much shorter than the reference get extended when the source still has picture.
- Missing captions get the script line. The wrong case gets corrected.
- A hook longer than 1.8× the style's hook length gets shortened.
- A cut more than 15% over the script length gets trimmed from later shots, not the hook.

## Apply

Checking does not change the timeline. Applying does. Run the check again after applying. A second pass should come back matched.

If the person has just trimmed by hand, show the notes before applying. The automated room applies once, re-exports, and checks again.

## Do not

- Invent shots that are not in the footage.
- Fail a cut for being a few tenths under the target. Too long is the problem. Too short is a note.
