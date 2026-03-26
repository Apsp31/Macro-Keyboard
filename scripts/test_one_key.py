#!/usr/bin/env python3
"""
Minimal read/write test for the 1189:8840 12-key + 2-knob macro pad.

Examples:
  python scripts/test_one_key.py read --layer 1 --button key1
  python scripts/test_one_key.py write --layer 1 --button key1 --text ABCD
  python scripts/test_one_key.py write --layer 1 --button key1 --binding ctrl+c
"""

import argparse
import os
import sys
import time

try:
    import usb.core
    import usb.util
    import usb.backend.libusb1
except ImportError:
    print("Install pyusb first: pip install pyusb", file=sys.stderr)
    sys.exit(1)

VENDOR_ID = 0x1189
PRODUCT_ID = 0x8840
REPORT_SIZE = 65
TARGET_INTERFACE = 0

BUTTON_NAMES = {
    "key1": 0x01, "key2": 0x02, "key3": 0x03, "key4": 0x04,
    "key5": 0x05, "key6": 0x06, "key7": 0x07, "key8": 0x08,
    "key9": 0x09, "key10": 0x0A, "key11": 0x0B, "key12": 0x0C,
    "knob1_left": 0x15, "knob1_press": 0x14, "knob1_right": 0x13,
    "knob2_left": 0x10, "knob2_press": 0x11, "knob2_right": 0x12,
}

MODIFIER = {
    "ctrl": 0x01, "control": 0x01,
    "shift": 0x02,
    "alt": 0x04,
    "meta": 0x08, "win": 0x08, "cmd": 0x08, "gui": 0x08,
}

KEY = {
    "none": 0x00,
    "a": 0x04, "b": 0x05, "c": 0x06, "d": 0x07, "e": 0x08, "f": 0x09,
    "g": 0x0A, "h": 0x0B, "i": 0x0C, "j": 0x0D, "k": 0x0E, "l": 0x0F,
    "m": 0x10, "n": 0x11, "o": 0x12, "p": 0x13, "q": 0x14, "r": 0x15,
    "s": 0x16, "t": 0x17, "u": 0x18, "v": 0x19, "w": 0x1A, "x": 0x1B,
    "y": 0x1C, "z": 0x1D,
    "1": 0x1E, "2": 0x1F, "3": 0x20, "4": 0x21, "5": 0x22,
    "6": 0x23, "7": 0x24, "8": 0x25, "9": 0x26, "0": 0x27,
    "enter": 0x28, "return": 0x28, "esc": 0x29, "escape": 0x29,
    "backspace": 0x2A, "tab": 0x2B, "space": 0x2C,
    "minus": 0x2D, "equal": 0x2E, "lbracket": 0x2F, "rbracket": 0x30,
    "backslash": 0x31, "hash": 0x32, "semicolon": 0x33, "quote": 0x34, "grave": 0x35,
    "comma": 0x36, "period": 0x37, "slash": 0x38,
    "right": 0x4F, "left": 0x50, "down": 0x51, "up": 0x52,
    "mute": 0x7F, "volume_up": 0x80, "volume_down": 0x81,
}

KEY_NAMES = {value: key for key, value in KEY.items() if value != 0}
TEXT_LAYOUT = os.environ.get("MACRODECK_TEXT_LAYOUT", "uk").strip().lower()
TEXT_SYMBOLS_BY_LAYOUT = {
    "uk": {
        "@": (0x02, KEY["quote"]),
        "\"": (0x02, KEY["2"]),
        "#": (0x00, KEY["hash"]),
        "~": (0x02, KEY["hash"]),
    },
    "us": {
        "@": (0x02, KEY["2"]),
        "\"": (0x02, KEY["quote"]),
        "#": (0x02, KEY["3"]),
        "~": (0x02, KEY["grave"]),
    },
}


def make_report(*first_bytes: int) -> bytes:
    data = list(first_bytes) + [0] * (REPORT_SIZE - len(first_bytes))
    return bytes(data[:REPORT_SIZE])


def send(ep, data: bytes) -> None:
    ep.write(data, timeout=2000)


def find_endpoint(dev, direction, interface_number=TARGET_INTERFACE):
    cfg = dev.get_active_configuration()
    for intf in cfg:
      if intf.bInterfaceNumber != interface_number:
          continue
      ep = usb.util.find_descriptor(
          intf,
          custom_match=lambda e: (
              usb.util.endpoint_direction(e.bEndpointAddress) == direction
              and usb.util.endpoint_type(e.bmAttributes) == usb.util.ENDPOINT_TYPE_INTR
          ),
      )
      if ep is not None:
          return ep
    raise RuntimeError(f"No interrupt endpoint for direction {direction}")


def open_device():
    backend = _get_backend()
    dev = usb.core.find(idVendor=VENDOR_ID, idProduct=PRODUCT_ID, backend=backend)
    if dev is None:
        raise RuntimeError("Device 1189:8840 not found")

    try:
        dev.set_configuration()
    except usb.core.USBError:
        for i in range(4):
            try:
                if dev.is_kernel_driver_active(i):
                    dev.detach_kernel_driver(i)
            except Exception:
                pass
        dev.set_configuration()

    cfg = dev.get_active_configuration()
    print("interfaces/endpoints:")
    for intf in cfg:
        print(f"  interface {intf.bInterfaceNumber} class=0x{intf.bInterfaceClass:02x} subclass=0x{intf.bInterfaceSubClass:02x} protocol=0x{intf.bInterfaceProtocol:02x}")
        for ep in intf:
            direction = "IN" if usb.util.endpoint_direction(ep.bEndpointAddress) == usb.util.ENDPOINT_IN else "OUT"
            transfer_type = usb.util.endpoint_type(ep.bmAttributes)
            print(f"    endpoint 0x{ep.bEndpointAddress:02x} {direction} type={transfer_type}")

    ep_out = find_endpoint(dev, usb.util.ENDPOINT_OUT, TARGET_INTERFACE)
    ep_in = find_endpoint(dev, usb.util.ENDPOINT_IN, TARGET_INTERFACE)
    print(f"using interface {TARGET_INTERFACE}, OUT=0x{ep_out.bEndpointAddress:02x}, IN=0x{ep_in.bEndpointAddress:02x}")
    return dev, ep_out, ep_in


def _get_backend():
    candidates = []

    env_path = os.environ.get("PYUSB_LIBUSB_PATH")
    if env_path:
        candidates.append(env_path)

    candidates.extend([
        r"C:\Program Files\Elgato\StreamDeck\libusb-1.0.dll",
        r"C:\Program Files (x86)\Steam\libusb-1.0.dll",
        r"C:\Program Files (x86)\Logitech\LogiTune\data\drivers\RightSight\libusb-1.0.dll",
    ])

    for path in candidates:
        if path and os.path.exists(path):
            backend = usb.backend.libusb1.get_backend(find_library=lambda _name, path=path: path)
            if backend is not None:
                return backend

    raise RuntimeError(
        "PyUSB libusb backend not found. Set PYUSB_LIBUSB_PATH to a valid libusb-1.0.dll path."
    )


def parse_binding(binding: str):
    binding = binding.strip().lower()
    if "+" not in binding:
        return [(0, KEY[binding])]

    parts = [part.strip() for part in binding.split("+")]
    mod = 0
    for part in parts[:-1]:
        mod |= MODIFIER[part]
    last = parts[-1]
    if last in MODIFIER:
        return [(mod | MODIFIER[last], 0)]
    return [(mod, KEY[last])]


def parse_text(text: str):
    result = []
    layout_symbols = TEXT_SYMBOLS_BY_LAYOUT.get(TEXT_LAYOUT, TEXT_SYMBOLS_BY_LAYOUT["uk"])
    for char in text:
        if char in layout_symbols:
            result.append(layout_symbols[char])
            continue
        lower = char.lower()
        if lower not in KEY:
            raise ValueError(f"Unsupported character for this simple test: {char!r}")
        modifier = 0x02 if char.isalpha() and char.isupper() else 0
        result.append((modifier, KEY[lower]))
    return result


def write_button(ep_out, button_id: int, layer: int, keys):
    payload = [
        0x03, 0xFD,
        button_id & 0xFF,
        layer & 0xFF,
        0x01, 0x00, 0x00, 0x00, 0x00,
        0x00,
        len(keys) & 0xFF,
    ]
    for mod, key in keys:
        payload.append(mod & 0xFF)
        payload.append(key & 0xFF)

    payload += [0] * (REPORT_SIZE - len(payload))
    send(ep_out, bytes(payload[:REPORT_SIZE]))
    send(ep_out, make_report(0x03, 0xFD, 0xFE, 0xFF))
    time.sleep(0.2)
    send(ep_out, make_report(0x03, 0xEF, 0x03))
    time.sleep(0.2)


def read_layer(ep_out, ep_in, layer: int):
    send(ep_out, make_report(0x03, 0xFA, 0x0F, 0x03, layer & 0xFF, 0x05))
    result = {}
    for _ in range(24):
        data = ep_in.read(REPORT_SIZE, timeout=1000)
        if len(data) < 13:
            continue
        button_id = data[2]
        key_count = data[10]
        keys = []
        for i in range(key_count):
            offset = 11 + i * 2
            if offset + 1 < len(data):
                keys.append((int(data[offset]), int(data[offset + 1])))
        result[button_id] = keys
    return result


def describe_keys(keys):
    if not keys:
        return "(unbound)"

    parts = []
    for mod, key in keys:
        prefix = ""
        if mod & 0x01:
            prefix += "ctrl+"
        if mod & 0x02:
            prefix += "shift+"
        if mod & 0x04:
            prefix += "alt+"
        if mod & 0x08:
            prefix += "meta+"
        parts.append(f"{prefix}{KEY_NAMES.get(key, f'0x{key:02x}')}")
    return ", ".join(parts)


def main():
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    read_parser = subparsers.add_parser("read")
    read_parser.add_argument("--layer", type=int, default=1)
    read_parser.add_argument("--button", default="key1", choices=sorted(BUTTON_NAMES.keys()))

    write_parser = subparsers.add_parser("write")
    write_parser.add_argument("--layer", type=int, default=1)
    write_parser.add_argument("--button", default="key1", choices=sorted(BUTTON_NAMES.keys()))
    group = write_parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--text")
    group.add_argument("--binding")

    args = parser.parse_args()
    _, ep_out, ep_in = open_device()
    button_id = BUTTON_NAMES[args.button]

    if args.command == "read":
        layer_data = read_layer(ep_out, ep_in, args.layer)
        keys = layer_data.get(button_id, [])
        print(f"layer {args.layer} {args.button}: {describe_keys(keys)}")
        return

    keys = parse_text(args.text) if args.text is not None else parse_binding(args.binding)
    print(f"writing layer {args.layer} {args.button}: {describe_keys(keys)}")
    write_button(ep_out, button_id, args.layer, keys)
    layer_data = read_layer(ep_out, ep_in, args.layer)
    print(f"readback layer {args.layer} {args.button}: {describe_keys(layer_data.get(button_id, []))}")


if __name__ == "__main__":
    main()
