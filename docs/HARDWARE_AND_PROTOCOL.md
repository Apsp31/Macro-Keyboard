# Hardware And Protocol Notes

This document captures the current understanding of the `VID 1189 / PID 8840` macro keyboard family and the practical setup needed to program it from this project.

## Hardware Summary

The target board currently under test is:

- `VID 1189`
- `PID 8840`
- 12 keys in a `3 x 4` grid
- 2 clickable rotary wheels
- 3 onboard layers

On Windows, the board exposes multiple HID collections, including normal keyboard/media paths plus a vendor/programming interface.

## Important Interfaces

Observed interfaces:

- `Interface 0`
  - vendor/programming path
  - interrupt `OUT 0x04`
  - interrupt `IN 0x84`
- `Interface 1`
  - normal keyboard/media/mouse style collections

The app uses:

- `node-hid` for detection/enumeration
- `PyUSB + libusb` for real board programming

## Why HID Detection And Programming Are Split

The board can look like a normal keyboard to Windows for live key output, but still use a different low-level interface for configuration writes.

That means:

- reading which HID collections exist is not the same as
- writing macros to flash

This is why the Electron app enumerates devices in Node, but delegates programming to the Python helper.

## Windows Driver Notes

For real programming on Windows, `Interface 0` must be reachable through a libusb-compatible path.

Working setup used during development:

1. Keep the normal keyboard interface alone.
2. Bind only `USB Composite Device (Interface 0)` to a libusb-compatible driver path.
3. Provide a working `libusb-1.0.dll`.

In this project, the Python helper looks for `libusb-1.0.dll` using:

- `PYUSB_LIBUSB_PATH`
- known fallback locations such as the Stream Deck libusb DLL

Example:

```powershell
$env:PYUSB_LIBUSB_PATH="C:\Program Files\Elgato\StreamDeck\libusb-1.0.dll"
```

## Python Runtime Notes

The Electron main process launches the helper script and now tries these Python commands in order:

- `MACRODECK_PYTHON` if explicitly set
- `python`
- `py -3`
- `py`

If needed, force a specific interpreter:

```powershell
$env:MACRODECK_PYTHON="C:\Users\alan\AppData\Local\Programs\Python\Python39\python.exe"
npm.cmd run dev
```

## Current Programming Protocol

The current implementation is based on the reverse-engineered protocol used by the OEM software and compatible community tooling for this exact board family.

Key facts:

- report size: `65` bytes
- button write prefix: `03 fd`
- commit: `03 fd fe ff`
- save to flash: `03 ef 03`
- read layer request: `03 fa 0f 03 <layer> 05`

Current helper responsibilities:

- read all layers
- write text to keys
- write explicit key/media/chord bindings
- duplicate one layer to another

## Layout Caveat

Text is not stored as Unicode text. It is stored as HID key presses.

That means symbols such as:

- `@`
- `#`
- `"`
- `~`

depend on the target keyboard layout of the destination machine.

This is why the app supports a per-layer target keyboard selection such as:

- `Windows UK`
- `Windows US`
- `macOS UK`
- `macOS US`

## What Is App Metadata Versus Board State

Stored on the board:

- key bindings
- wheel bindings
- layers

Stored only in the app:

- key labels shown in the UI
- layer names shown in the UI
- target keyboard selection per layer

Those app-side settings are useful for organization, but they are not flashed to the device firmware.

## Known Limits

- Mouse-specific OEM actions are not yet modeled as first-class programmable actions.
- RGB/lighting is intentionally hidden in the current UI for this tested board because this unit does not need that exposed.
- Profile import/export is not implemented yet.

## Acknowledgements And Source Material

This project is informed by a mix of direct testing, OEM software inspection, and community reverse-engineering work.

Key sources and inspiration:

- The OEM Windows bundle supplied with the device and inspected locally in this workspace
  - used to confirm feature intent such as layers, download/read actions, and the general HID-based programming path
- [`mikhailvs/macropad`](https://github.com/mikhailvs/macropad)
  - especially valuable for matching this exact `1189:8840` family and for providing a concrete programming model and protocol direction
- [`kriomant/ch57x-keyboard-tool`](https://github.com/kriomant/ch57x-keyboard-tool)
  - useful confirmation that this board family is genuinely programmable and part of a broader CH57x ecosystem
- User-provided USB/HID probing, capture files, and live Windows validation
  - crucial for confirming the actual working interface, driver path, and successful read/write behavior on this specific unit

Thanks are due to the contributors and reverse-engineers behind those public projects for publishing their findings and code. Their work materially reduced the amount of blind protocol guessing required here and helped turn this board from an opaque OEM device into something we could program openly.

This app does not copy the OEM UI. The goal is to build a clearer and more reliable tool while acknowledging the protocol research and observed device behavior that made the current implementation possible.
