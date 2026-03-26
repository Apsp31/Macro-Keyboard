# MacroDeck Studio

MacroDeck Studio is a fresh desktop project for building a user-friendly macro manager for CH57x-style USB macro keyboards in Windows.

## Target Device

The current target hardware is a keyboard-like USB device seen by Windows as:

- `USB\VID_1189&PID_8840&MI_01`
- Child collection: `VID_1189&PID_8840&MI_01&Col03`
- Driver: `keyboard.inf`
- Matching device ID: `HID_DEVICE_SYSTEM_KEYBOARD`

That strongly suggests this is presenting at least part of its functionality as a standard HID keyboard collection rather than via a rich vendor SDK. Based on the device family research and your hardware notes, the current app model assumes:

- A 3x4 key matrix
- Two clickable scroll wheels on the right
- Three switchable onboard layers or key sets

Because of that, this project is structured around:

1. Enumerating HID devices and filtering by VID/PID.
2. Separating device transport from profile/macro logic.
3. Supporting reverse-engineering and fallback workflows when the board only emits key events.

## Stack

- Electron for the Windows desktop shell
- React + TypeScript for the UI
- `node-hid` for direct HID access
- Shared TypeScript models for renderer/main IPC boundaries

## Project Layout

- `src/main`: Electron main process and device services
- `src/preload`: secure IPC bridge
- `src/renderer`: React app
- `src/shared`: cross-process types
- `docs/HARDWARE_AND_PROTOCOL.md`: hardware setup, driver notes, and protocol summary
- `docs/KNOWN_ISSUES.md`: tracked future features and known gaps
- `docs/VERSION_HISTORY.md`: project version history

## Getting Started

Install dependencies:

```bash
npm install
```

Run the app in development:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

## Current State

This scaffold already includes:

- A desktop shell
- A polished first-pass UI
- Real HID enumeration for `VID_1189` / `PID_8840` via `node-hid`
- A CH57x-oriented profile model with matrix layout, layers, wheels, and lighting
- A Python/PyUSB backend path for real onboard read/write on Windows
- Real local profile save/load for board state plus app-side labels/layer settings
- A mock fallback workspace when the device or native HID module is unavailable
- IPC wiring between the renderer and Electron
- Diagnostics in the UI so detection state is visible

## Next Implementation Steps

1. Confirm how the device exposes writable macro data, if at all.
2. Capture live key events from the macro pad to identify per-key mappings.
3. Probe for feature and output reports to determine whether onboard macro storage exists.
4. Add import/export support for profiles.
5. Add a richer macro editor timeline and mouse-style OEM actions.

## Environment Note

This workspace could not be runtime-tested here because `node` and `npm` are not currently available in PATH on this machine. Once Node.js is installed, run `npm install` followed by `npm run dev`.

## Windows Programming Note

For real board programming on Windows, the vendor programming interface (`VID 1189 / PID 8840 / Interface 0`) needs a libusb-compatible path. In your setup this was made accessible and PyUSB was configured using:

```powershell
$env:PYUSB_LIBUSB_PATH="C:\Program Files\Elgato\StreamDeck\libusb-1.0.dll"
```

The Electron app now uses a small Python helper to read and write the keyboard using the same proven protocol.

For the fuller setup and protocol notes, see:

- [docs/HARDWARE_AND_PROTOCOL.md](docs/HARDWARE_AND_PROTOCOL.md)
  This also includes acknowledgements for the OEM tool and community reverse-engineering work that informed this project.

## Notes On This Hardware

Many low-cost macro keyboards identify as normal keyboards and only provide customization through weak vendor software. If this device does not expose a writable HID feature/output report, the software may need to work in one of these ways:

- Device-side programming through undocumented reports discovered by inspection.
- Host-side remapping that listens for device-specific key combinations and triggers macros locally.
- A hybrid approach that stores profiles on the PC while using the keyboard as an input trigger surface.

This codebase is intentionally shaped to support all three.
