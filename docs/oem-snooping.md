# OEM Snooping Workflow

These scripts help compare the keyboard's behavior with and without the OEM app open.

## Commands

Run from:

```powershell
cd "C:\Users\alan\OneDrive\Documents\Playground"
```

Enumerate all matching interfaces:

```powershell
node .\scripts\hid-enumerate.js
```

Probe feature reports on the vendor HID interface:

```powershell
node .\scripts\hid-probe-feature-reports.js
```

Monitor the vendor HID interface for 30 seconds:

```powershell
node .\scripts\hid-monitor-vendor.js
```

Monitor the mouse/media collections for 30 seconds:

```powershell
node .\scripts\hid-monitor-collections.js
```

## Suggested Sequence

1. Run `hid-enumerate.js` with the keyboard connected and OEM app closed.
2. Run `hid-monitor-vendor.js`.
3. While it listens, open the OEM software.
4. In the OEM software, click `Read configuration`.
5. Switch between all three layers.
6. If the OEM software recognizes the device enough to allow it, click `Download`.
7. Repeat once with `hid-monitor-collections.js` running instead.

## What To Look For

- `OPEN ERR` on the vendor interface after launching the OEM app:
  likely means the OEM app opened that path exclusively.
- `DATA` on the vendor interface during `Read configuration`:
  strong sign that config traffic is happening over HID input reports.
- No `DATA`, but changed ability to open the device:
  the OEM app may be using HID writes only.
- `DATA` on the media collection:
  useful for mapping wheels and media actions, but not usually for config.
