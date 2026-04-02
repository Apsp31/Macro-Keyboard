# Learnings

This document captures the practical lessons learned while turning a weak OEM macro-keyboard toolchain into a working open desktop app for the `1189:8840` board family.

It is intentionally more narrative than the protocol notes or version history. The goal is to preserve why decisions were made, what went wrong, and what future work should assume.

## Hardware Learnings

### The board is genuinely programmable

The keyboard is not just a generic HID trigger pad with no onboard storage.

We confirmed that:

- it exposes a real vendor/programming interface on `Interface 0`
- it supports reading current bindings
- it supports writing bindings and saving them to flash
- those writes survive and can be read back again

That changed the product direction significantly. Early on, host-side remapping looked like the safest fallback. Once real read/write was proven, the project could correctly focus on device-side programming first.

### The board presents two personalities at once

The hardware behaves as:

- a normal USB keyboard/media device for live input
- a separate vendor/programming device for configuration

This split matters a lot:

- live input probing and config programming are not the same task
- successful enumeration with `node-hid` does not prove the write path works
- Windows can happily use the keyboard side while still blocking the programming side until the driver path is fixed

### The physical layout is simple, but the software model must stay exact

The target board is:

- 12 keys
- 3 rows x 4 columns
- 2 clickable rotary wheels
- 3 onboard layers

Even small mapping mistakes create immediate confusion. A stale mock-era row/column assignment made `Key 12` appear in the wrong tile. The fix was to derive row/column from key number instead of hand-maintaining coordinates.

Lesson:

- physical matrix placement should be computed, not repeated manually

## Reverse Engineering Learnings

### Generic HID feature probing was not enough

Early probes against the vendor interface returned no useful feature-report data.

That could easily have led to the wrong conclusion that the board was effectively unreadable or write-only. In reality, the programming path existed; we were just probing the wrong way.

Lesson:

- failure of ad hoc `getFeatureReport()` probing does not prove the board cannot be programmed
- protocol shape matters more than generic “does any report answer?” experiments

### Community reverse engineering saved a huge amount of time

The breakthrough came from finding compatible community work for the same board family.

Most useful:

- [`mikhailvs/macropad`](https://github.com/mikhailvs/macropad)
- [`kriomant/ch57x-keyboard-tool`](https://github.com/kriomant/ch57x-keyboard-tool)

These sources helped confirm:

- exact device family match
- that the hardware was really programmable
- protocol direction and report structure
- layer and wheel capability assumptions

Lesson:

- before inventing a new reverse-engineering path, always check for adjacent community work on the same cheap OEM family

### OEM software inspection still mattered

Even though the OEM application was poor, it was still useful for:

- confirming the existence of concepts like `Read configuration`, `Download`, layers, and LEDs
- validating that the vendor considered the board configurable
- reinforcing that the board belonged to a broader CH57x ecosystem

Lesson:

- poor OEM software can still be valuable source material
- UI labels, resources, and strings often reveal capabilities even when the app itself is unreliable

## Windows Setup Learnings

### The working programming path on Windows depends on Interface 0

Programming works only when the vendor/programming interface is reachable through a libusb-compatible path.

The reliable setup found during development was:

1. leave the keyboard/media interface alone
2. target only `USB Composite Device (Interface 0)`
3. make PyUSB able to use `libusb-1.0.dll`

Lesson:

- never replace the normal keyboard interface driver unless there is no other choice
- isolate the programmable interface instead

### Partial moves and live files cause chaos on Windows

When the project was moved from `Playground` to `F:\Coding\Codex\Macro Keyboard Manager`, the move partially failed because OEM files were still open or locked.

The Git history moved successfully, but some working files did not. The cleanest recovery was:

- move what could move
- restore tracked files from Git in the destination
- treat the new path as authoritative

Lesson:

- on Windows, whole-project moves are safer when no OEM app, editor, or build process still has files open
- if a Git repo moves partially, restoring from Git in the destination is often cleaner than continuing to fight file locks

### `node_modules` should be treated as disposable during moves

After the move, the repo itself was fine but `node_modules` was not. A missing dependency inside `concurrently` caused `npm run dev` to fail.

Lesson:

- after a partial move, expect `node_modules` to be untrustworthy
- the right repair is usually `npm install`, or delete `node_modules` and reinstall cleanly

## Product And UX Learnings

### Mock-era UI assumptions become liabilities quickly

Several early UI elements came from scaffold/mock thinking instead of verified board behavior:

- fake profile surfaces
- oversized hero content
- always-visible layer settings
- persistent wheel panel even when editing a key
- lighting affordances for a board variant that did not need them

These all created friction once the tool became real.

Lesson:

- when a prototype becomes a real hardware tool, aggressively remove mock leftovers
- stale affordances are worse than missing affordances because they mislead

### Context-sensitive editing is much clearer than “show everything”

The UI improved when it switched to:

- selected key editor when a key is selected
- selected wheel editor when a wheel is selected
- layer settings only when explicitly opened

Lesson:

- editing hardware bindings is easier when the UI only shows controls relevant to the current selection

### Labels are app metadata, not board metadata

The device stores bindings, not friendly names.

This matters both technically and product-wise:

- labels must be persisted separately
- saving a label should be clearly described as an app-side action
- loading a board read should not silently imply that tile names came from the device

Lesson:

- always separate “what is on the board” from “what the app remembers about the board”

### Browser localStorage was not robust enough for important metadata

Labels and layer names were initially stored in renderer localStorage. That turned out to be too fragile:

- key identity assumptions changed during development
- browser/dev storage can be reset or become inconsistent
- once labels were lost, recovery was uncertain

The fix was to move app metadata persistence into an Electron-managed JSON file.

Lesson:

- anything users will care about losing should not depend only on renderer localStorage

## Text And Layout Learnings

### “Text” is really stored as key presses, not Unicode

This is the most important portability lesson in the project.

The board does not store abstract text. It stores HID key events.

That means:

- letters and digits are relatively portable
- symbol characters depend on physical keyboard layout
- some shortcuts depend on operating system conventions

Lesson:

- a hardware macro keyboard cannot make a single symbol macro truly universal across all hosts

### The useful distinction is layout vs OS

The project currently models four targets:

- `Windows UK`
- `Windows US`
- `macOS UK`
- `macOS US`

In practice:

- printable ASCII differences are mostly `UK` vs `US`
- platform shortcut differences are mostly `Windows` vs `macOS`

This is why:

- `Windows US` and `macOS US` share the same base printable-key mapping
- `Windows UK` and `macOS UK` share the same base printable-key mapping
- platform-specific aliases like `lock` differ by OS target

Lesson:

- do not overstate platform differences where they are really layout differences
- but do not hide real OS differences for shortcuts either

### Special bindings must honor the same target model as text

At one point, layer target affected text writes but not special bindings. That was misleading and the user correctly called it out.

Lesson:

- any “target system” concept must apply consistently across all relevant write paths, not just one editor mode

## Git And Documentation Learnings

### Repo-relative links matter

Links that work inside the app using local absolute paths do not work on GitHub.

Lesson:

- repo docs should always use GitHub-friendly relative links
- app responses can still use absolute local file links when appropriate

### Version history needs to move with real behavior changes

The project initially drifted on version discipline. Later changes corrected that by:

- incrementing app version for real behavior changes
- updating `docs/VERSION_HISTORY.md`
- committing and pushing those changes

Lesson:

- version numbers are part of trust, especially when debugging regressions in a hardware tool

### Meaningful findings should be captured in docs, not just chat

The project now has multiple documentation layers:

- protocol/setup notes
- version history
- known issues
- acknowledgements
- this learnings file

Lesson:

- reverse-engineering knowledge decays quickly if it only lives in conversation history
- docs should preserve both facts and the reasoning behind them

## What Future Work Should Assume

- The board is writable and readable; do not regress to assuming host-side-only control unless a specific feature truly requires that fallback.
- Interface `0` is the key programming path on Windows.
- Board bindings and app metadata are separate concerns.
- Layer-aware target keyboard selection is essential for usable text and shortcut behavior.
- Mouse-style OEM actions remain the largest functional gap versus full OEM parity.
- Any future persistence feature should prefer main-process or file-backed storage over renderer-only browser storage.

## Still Open

The biggest remaining gaps are:

- first-class mouse-style OEM actions
- profile import/export to files
- richer macro editing beyond text/chord sequence entry
- continued hardening of app metadata behavior so labels/names feel completely dependable
