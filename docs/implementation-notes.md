# Implementation decisions

The latest conversation replaces the original folder/library screen with one MP3 per project, a File menu for open/recent projects, and an editor tool rail with contextual properties. The UI is charcoal/neutral; the visualizer defaults to white. Editable element positions/sizes and lyric tables are included per the implementation request following the prototype review. Original spec remains historical; these decisions supersede its conflicting UI details.

Code is developed in the attached managed worktree. User media stays in `.local-data/` and is not committed.

## Final implementation choices and review

- Shared scene output uses JPEG quality 0.94 into FFmpeg instead of PNG for throughput. This adds a small loss before H.264 compression; the four-frame comparison is recorded in verification.md.
- Font preparation covers actual project text. First-frame/subsequent-frame equality tests replaced the planned synthetic font-delay test.
- Small helpers are grouped into fewer modules than the historical plan. The Project, Spectrum and shared renderer boundaries remain explicit.
- Fresh independent review found three Important issues: unseen long lyrics, delayed asset response races, cancellation during uncached analysis. All three were reproduced and fixed; final suite passed. No deferred minor findings.
- Historical folder/library/green/fixed-layout requirements were superseded by the latest user direction. Reversing this decision would require UI changes.
- Only macOS/Chromium and a 180-second render were verified. Two-hour maximum inputs and other platforms need separate validation; this is not a performance guarantee.
- Abrupt process death does not restore an export job journal. Retry is required; completed files stay preserved. A forced kill can leave a partial file. The narrow final-promotion cancellation window was inspected without evidence of a further defect; no speculative change was made.
- Production frame/audio comparison and documentation were completed independently of review, with measurements in verification.md.
- The native managed worktree is retained for the running app. No merge, push or publication was requested or performed.

The historical plan's checkbox list describes the original execution approach; the implemented scope and verification record above supersede it. Some failure scenarios are covered at the job/storage boundary rather than by forcing actual disk exhaustion or killing a real encoder. Those system-fault scenarios are not claimed as fully end-to-end tested.
