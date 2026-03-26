# Known Issues

This file is the local issue tracker for the project until a remote Git hosting workflow is set up.

## Open

- Mouse-style OEM actions are not yet implemented as first-class programmable actions in the UI/backend.
- Layer names and key labels are app-side metadata only; the keyboard itself stores bindings, not labels.
- Text macros that include symbols depend on the selected target keyboard layout and are not universally portable across all host layouts.
- The board capability model still assumes no RGB support for this specific unit; if a variant with LEDs is confirmed later, the UI should make that capability conditional per device.

## Tracking Guidance

- Record user-visible regressions and protocol gaps here as flat bullet points.
- Remove an item once it is fixed in a committed change.
- Prefer linking future fixes to a Git commit hash in the note when possible.
