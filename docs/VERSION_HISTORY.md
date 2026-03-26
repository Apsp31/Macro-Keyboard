# Version History

## 0.1.5

- Made app-side key labels and layer names use a stable device identity instead of a volatile HID path fallback.
- Added broader fallback lookup and migration so previously saved labels can be recovered and re-saved under the stable keys.

## 0.1.4

- Fixed the matrix-position mapping so keys are placed consistently as `1-4`, `5-8`, `9-12`.
- Removed stale mock-era row/column assignments that caused keys such as `Key 12` to appear in the wrong tile position.

## 0.1.3

- Moved layer-wide controls behind an explicit `Edit Layer` toggle near the layer tabs.
- Defaulted the lower editor area back to the currently selected key or wheel.
- Kept layer switching in layer-edit mode when changing tabs, while key and wheel selection continue to exit back to their relevant editor.

## 0.1.2

- Passed the per-layer target keyboard through the special-binding path, not just text writes.
- Added explicit `Print Screen` and `Lock Screen` picker actions for keys and wheels.
- Made `lock` target-aware:
  - Windows layers write `Win+L`
  - macOS layers write `Control+Command+Q`
- Clarified the practical layout model in docs:
  - printable ASCII currently differs by physical layout (`UK` vs `US`)
  - platform-specific shortcuts differ by OS (`Windows` vs `macOS`)

## 0.1.1

- Disabled automatic DevTools opening during development unless explicitly requested.
- Added app version display to the UI.
- Added hardware/protocol documentation and acknowledgements.
- Added per-layer target keyboard selection for text encoding.
- Added duplicate-layer support on the board.
- Improved duplicate-layer behavior to switch to the copied layer after completion.
- Optimized duplicate-layer writes to avoid saving to flash after every single key.
- Added wheel binding editing.
- Auto-read board config on startup.
- Added persistent app-side layer names and key labels.
- Switched the editor to show only the context-relevant editor for the selected key or wheel.
- Removed misleading profile UI that did not yet exist as a real feature.

## 0.1.0

- Initial Electron + React + TypeScript desktop scaffold.
- Added CH57x-oriented layout model for a 3x4 board with 2 wheels and 3 layers.
- Added HID enumeration and diagnostics for `VID 1189 / PID 8840`.
- Added working PyUSB/libusb programming backend for onboard read/write on Windows.
- Added basic board read, key write, binding write, and layer duplication support.
