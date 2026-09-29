# Local visual QA status

## Actual evidence in this continuation

The browser-facing candidate is retained **locally and uncommitted**, excluded from the backend foundation push until visual QA can be completed. The checklist and blocker record are committed for handoff. Do not recreate the local artwork or CSS work.

- Original five-vehicle SVG contact sheet rasterized with Sharp and visually inspected locally at `.artifacts/vehicle-artwork.png`. This is asset inspection, not a browser screenshot.
- Source-level corrections: mobile header wrapping, small-screen form columns, legible unavailable labels, darker small captions, readable hero emphasis, 220ms vehicle reveal and reduced-motion hover suppression. Admin gets a focusable skip target, wrapping rows and a single-column metric layout below 480px.
- Browser screenshot and responsive viewport checks: **BLOCKED, not passed**. Browser tool attempts to open `http://127.0.0.1:3001` were rejected by a saved user permission. After the user said they would enable access, one recheck returned the same rejection. No alternate browser, raw browser commands, indirect rendering of the page or other permission workaround was used.
- Flutter's existing render harness, widget layout checks and Android journeys are separate evidence; consult BUILD_PROGRESS for this continuation's rerun results.

## Required browser matrix once permission is changed

Use only local previews: updated demo `http://127.0.0.1:4174` and Admin `http://127.0.0.1:3001`. Port 4173 preserves an older process and may not serve the new SVG routes until its state is deliberately accounted for and that process is restarted.

| Viewports | Pages and actions | Required observations |
| --- | --- | --- |
| 320×740, 390×844 | Demo Customer, Partner, Admin | No page overflow; readable labels; intact vehicle proportions; service gates; form errors and history wrap |
| 768×1024, 1440×1000 | Same demo views | Balanced grid/hero; no clipped forms or art; keyboard focus visible |
| All four sizes | Next overview and all 11 section routes | Navigation wraps; skip link works; summaries/doc text and long IDs wrap; metrics and calendars remain usable |
| Narrow + 200% text | Booking forms, Next dispatch/plans | No lost controls/content; scrolling usable |
| Reduced motion | Hero/card reveal, hover and navigation | No persistent shimmer, movement suppressed without losing content |
| Offline API | Next overview/section, demo forms | Clear errors; no fake booking or approval success |

Save local screenshots with route, viewport and motion mode in filenames; record actual failures/fixes and rerun relevant tests. Do not mark this matrix complete from static HTML checks or CSS inspection alone. A physical budget-Android 60fps claim still requires separate profiling.
