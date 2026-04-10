#!/usr/bin/env python3
"""
Small JSON backend for the 1189:8840 macro pad.

Commands:
  python scripts/macropad_backend.py read
  python scripts/macropad_backend.py write-text --layer 1 --button key1 --text TEST --text-layout win-uk
  python scripts/macropad_backend.py write-binding --layer 1 --button key1 --binding "ctrl+c"
  python scripts/macropad_backend.py duplicate-layer --source-layer 1 --target-layer 2
  python scripts/macropad_backend.py apply-profile --profile-json path/to/profile.json
"""

import argparse
import json
import os
import sys
import time

try:
    import usb.core
    import usb.util
    import usb.backend.libusb1
except ImportError:
    print(json.dumps({"ok": False, "error": "Install pyusb: pip install pyusb"}))
    sys.exit(1)

VENDOR_ID = 0x1189
PRODUCT_ID = 0x8840
REPORT_SIZE = 65
TARGET_INTERFACE = 0
BUTTONS_PER_LAYER = 24
NUM_LAYERS = 3

BUTTON_NAMES = {
    "key1": 0x01, "key2": 0x02, "key3": 0x03, "key4": 0x04,
    "key5": 0x05, "key6": 0x06, "key7": 0x07, "key8": 0x08,
    "key9": 0x09, "key10": 0x0A, "key11": 0x0B, "key12": 0x0C,
    "knob2_left": 0x10, "knob2_press": 0x11, "knob2_right": 0x12,
    "knob1_right": 0x13, "knob1_press": 0x14, "knob1_left": 0x15,
}
BUTTON_ID_TO_NAME = {value: key for key, value in BUTTON_NAMES.items()}

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
    "comma": 0x36, "period": 0x37, "slash": 0x38, "non_us_backslash": 0x64,
    "capslock": 0x39,
    "f1": 0x3A, "f2": 0x3B, "f3": 0x3C, "f4": 0x3D, "f5": 0x3E, "f6": 0x3F,
    "f7": 0x40, "f8": 0x41, "f9": 0x42, "f10": 0x43, "f11": 0x44, "f12": 0x45,
    "printscreen": 0x46, "scrolllock": 0x47, "pause": 0x48,
    "insert": 0x49, "home": 0x4A, "pageup": 0x4B, "delete": 0x4C, "end": 0x4D, "pagedown": 0x4E,
    "right": 0x4F, "left": 0x50, "down": 0x51, "up": 0x52,
    "f13": 0x68, "f14": 0x69, "f15": 0x6A, "f16": 0x6B, "f17": 0x6C, "f18": 0x6D,
    "f19": 0x6E, "f20": 0x6F, "f21": 0x70, "f22": 0x71, "f23": 0x72, "f24": 0x73,
    "mute": 0x7F, "volume_up": 0x80, "volume_down": 0x81,
}
KEY_NAMES = {value: key for key, value in KEY.items() if value != 0}
MODIFIER = {
    "ctrl": 0x01, "control": 0x01, "lctrl": 0x01,
    "shift": 0x02, "lshift": 0x02,
    "alt": 0x04, "option": 0x04, "lalt": 0x04,
    "meta": 0x08, "win": 0x08, "cmd": 0x08, "gui": 0x08,
}
COMMON_SYMBOLS = {
    " ": (0x00, KEY["space"]),
    "-": (0x00, KEY["minus"]),
    "_": (0x02, KEY["minus"]),
    "=": (0x00, KEY["equal"]),
    "+": (0x02, KEY["equal"]),
    "[": (0x00, KEY["lbracket"]),
    "{": (0x02, KEY["lbracket"]),
    "]": (0x00, KEY["rbracket"]),
    "}": (0x02, KEY["rbracket"]),
    ";": (0x00, KEY["semicolon"]),
    ":": (0x02, KEY["semicolon"]),
    "'": (0x00, KEY["quote"]),
    "\"": (0x02, KEY["quote"]),
    ",": (0x00, KEY["comma"]),
    "<": (0x02, KEY["comma"]),
    ".": (0x00, KEY["period"]),
    ">": (0x02, KEY["period"]),
    "/": (0x00, KEY["slash"]),
    "?": (0x02, KEY["slash"]),
}
SPECIAL_BINDING_ALIASES = {
    "printscreen": lambda _layout: [(0x00, KEY["printscreen"])],
    "prtsc": lambda _layout: [(0x00, KEY["printscreen"])],
    "lock": lambda layout: [(0x08, KEY["l"])] if layout.startswith("win-") else [(0x01 | 0x08, KEY["q"])],
}
TEXT_SYMBOLS_BY_LAYOUT = {
    "win-us": {
        **COMMON_SYMBOLS,
        "`": (0x00, KEY["grave"]),
        "~": (0x02, KEY["grave"]),
        "\\": (0x00, KEY["backslash"]),
        "|": (0x02, KEY["backslash"]),
        "!": (0x02, KEY["1"]),
        "@": (0x02, KEY["2"]),
        "#": (0x02, KEY["3"]),
        "$": (0x02, KEY["4"]),
        "%": (0x02, KEY["5"]),
        "^": (0x02, KEY["6"]),
        "&": (0x02, KEY["7"]),
        "*": (0x02, KEY["8"]),
        "(": (0x02, KEY["9"]),
        ")": (0x02, KEY["0"]),
    },
    "mac-us": {
        **COMMON_SYMBOLS,
        "`": (0x00, KEY["grave"]),
        "~": (0x02, KEY["grave"]),
        "\\": (0x00, KEY["backslash"]),
        "|": (0x02, KEY["backslash"]),
        "!": (0x02, KEY["1"]),
        "@": (0x02, KEY["2"]),
        "#": (0x02, KEY["3"]),
        "$": (0x02, KEY["4"]),
        "%": (0x02, KEY["5"]),
        "^": (0x02, KEY["6"]),
        "&": (0x02, KEY["7"]),
        "*": (0x02, KEY["8"]),
        "(": (0x02, KEY["9"]),
        ")": (0x02, KEY["0"]),
    },
    "win-uk": {
        **COMMON_SYMBOLS,
        "`": (0x00, KEY["grave"]),
        "¬": (0x02, KEY["grave"]),
        "\\": (0x00, KEY["backslash"]),
        "|": (0x02, KEY["backslash"]),
        "!": (0x02, KEY["1"]),
        "\"": (0x02, KEY["2"]),
        "£": (0x02, KEY["3"]),
        "$": (0x02, KEY["4"]),
        "%": (0x02, KEY["5"]),
        "^": (0x02, KEY["6"]),
        "&": (0x02, KEY["7"]),
        "*": (0x02, KEY["8"]),
        "(": (0x02, KEY["9"]),
        ")": (0x02, KEY["0"]),
        "@": (0x02, KEY["quote"]),
        "~": (0x02, KEY["hash"]),
        "#": (0x00, KEY["hash"]),
    },
    "mac-uk": {
        **COMMON_SYMBOLS,
        "`": (0x00, KEY["non_us_backslash"]),
        "\\": (0x00, KEY["hash"]),
        "|": (0x02, KEY["hash"]),
        "!": (0x02, KEY["1"]),
        "£": (0x02, KEY["3"]),
        "$": (0x02, KEY["4"]),
        "%": (0x02, KEY["5"]),
        "^": (0x02, KEY["6"]),
        "&": (0x02, KEY["7"]),
        "*": (0x02, KEY["8"]),
        "(": (0x02, KEY["9"]),
        ")": (0x02, KEY["0"]),
        "@": (0x02, KEY["2"]),
        "~": (0x02, KEY["non_us_backslash"]),
        "#": (0x04, KEY["3"]),
    },
}


def fail(message: str):
    print(json.dumps({"ok": False, "error": message}))
    sys.exit(1)


def get_backend():
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

    fail("libusb backend not found. Set PYUSB_LIBUSB_PATH to libusb-1.0.dll")


def make_report(*first_bytes):
    payload = list(first_bytes) + [0] * (REPORT_SIZE - len(first_bytes))
    return bytes(payload[:REPORT_SIZE])


def send(ep, data: bytes):
    ep.write(data, timeout=2000)


def find_endpoint(dev, direction):
    cfg = dev.get_active_configuration()
    for intf in cfg:
        if intf.bInterfaceNumber != TARGET_INTERFACE:
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
    raise RuntimeError(f"No endpoint found for interface {TARGET_INTERFACE}")


def open_device():
    backend = get_backend()
    dev = usb.core.find(idVendor=VENDOR_ID, idProduct=PRODUCT_ID, backend=backend)
    if dev is None:
        fail("Device 1189:8840 not found")

    try:
        dev.set_configuration()
    except usb.core.USBError:
        for interface_number in range(4):
            try:
                if dev.is_kernel_driver_active(interface_number):
                    dev.detach_kernel_driver(interface_number)
            except Exception:
                pass
        dev.set_configuration()

    return dev, find_endpoint(dev, usb.util.ENDPOINT_OUT), find_endpoint(dev, usb.util.ENDPOINT_IN)


def parse_text(text: str, text_layout: str):
    result = []
    layout_symbols = TEXT_SYMBOLS_BY_LAYOUT.get(text_layout, TEXT_SYMBOLS_BY_LAYOUT["win-uk"])
    for char in text:
        if char in layout_symbols:
            result.append(layout_symbols[char])
            continue

        if char.isdigit():
            result.append((0x00, KEY[char]))
            continue

        lower = char.lower()
        if lower not in KEY:
            raise ValueError(f"Unsupported character for {text_layout} layout: {char!r}")
        modifier = 0x02 if char.isalpha() and char.isupper() else 0
        result.append((modifier, KEY[lower]))
    return result


def parse_binding_sequence(binding: str, text_layout: str):
    steps = []
    for token in binding.split(","):
        part = token.strip().lower()
        if not part:
            continue

        alias = SPECIAL_BINDING_ALIASES.get(part)
        if alias:
            steps.extend(alias(text_layout))
            continue

        pieces = [piece.strip() for piece in part.split("+") if piece.strip()]
        if not pieces:
            continue

        modifier = 0
        for piece in pieces[:-1]:
            if piece not in MODIFIER:
                raise ValueError(f"Unknown modifier: {piece}")
            modifier |= MODIFIER[piece]

        key_name = pieces[-1]
        if key_name in MODIFIER and len(pieces) == 1:
            steps.append((MODIFIER[key_name], 0))
            continue

        if key_name not in KEY:
            raise ValueError(f"Unknown key: {key_name}")
        steps.append((modifier, KEY[key_name]))

    if not steps:
        raise ValueError("Binding sequence is empty")

    return steps


def save_to_board(ep_out):
    send(ep_out, make_report(0x03, 0xEF, 0x03))
    time.sleep(0.2)


def write_button(ep_out, button_id: int, layer: int, keys, save: bool = True):
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
    if save:
        save_to_board(ep_out)


def read_layer(ep_out, ep_in, layer: int):
    send(ep_out, make_report(0x03, 0xFA, 0x0F, 0x03, layer & 0xFF, 0x05))
    result = {}
    for _ in range(BUTTONS_PER_LAYER):
        data = ep_in.read(REPORT_SIZE, timeout=1000)
        if len(data) < 13:
            continue
        button_id = int(data[2])
        key_count = int(data[10])
        keys = []
        for i in range(key_count):
            offset = 11 + i * 2
            if offset + 1 < len(data):
                keys.append((int(data[offset]), int(data[offset + 1])))
        result[button_id] = keys
    return result


def read_all(ep_out, ep_in):
    layers = {}
    for layer in range(1, NUM_LAYERS + 1):
        layer_data = read_layer(ep_out, ep_in, layer)
        named = {}
        for button_id, keys in sorted(layer_data.items()):
            if button_id in BUTTON_ID_TO_NAME:
                named[BUTTON_ID_TO_NAME[button_id]] = [
                    {"modifier": mod, "keycode": keycode, "key": KEY_NAMES.get(keycode, f"0x{keycode:02x}")}
                    for mod, keycode in keys
                ]
        layers[str(layer)] = named
    return layers


def command_read():
    _, ep_out, ep_in = open_device()
    print(json.dumps({"ok": True, "layers": read_all(ep_out, ep_in)}, indent=2))


def command_write_text(layer: int, button: str, text: str, text_layout: str):
    _, ep_out, ep_in = open_device()
    button_id = BUTTON_NAMES[button]
    keys = parse_text(text, text_layout)
    write_button(ep_out, button_id, layer, keys)
    layer_data = read_layer(ep_out, ep_in, layer)
    print(
        json.dumps(
            {
                "ok": True,
                "layer": layer,
                "button": button,
                "text": text,
                "textLayout": text_layout,
                "readback": layer_data.get(button_id, []),
            },
            indent=2,
        )
    )


def command_write_binding(layer: int, button: str, binding: str, text_layout: str):
    _, ep_out, ep_in = open_device()
    button_id = BUTTON_NAMES[button]
    keys = parse_binding_sequence(binding, text_layout)
    write_button(ep_out, button_id, layer, keys)
    layer_data = read_layer(ep_out, ep_in, layer)
    print(
        json.dumps(
            {
                "ok": True,
                "layer": layer,
                "button": button,
                "binding": binding,
                "textLayout": text_layout,
                "readback": layer_data.get(button_id, []),
            },
            indent=2,
        )
    )


def command_duplicate_layer(source_layer: int, target_layer: int):
    _, ep_out, ep_in = open_device()
    source_data = read_layer(ep_out, ep_in, source_layer)
    for button_id in BUTTON_ID_TO_NAME.keys():
        keys = source_data.get(button_id, [])
        write_button(ep_out, button_id, target_layer, keys if keys else [(0, 0)], save=False)
    save_to_board(ep_out)
    print(
        json.dumps(
            {
                "ok": True,
                "sourceLayer": source_layer,
                "targetLayer": target_layer,
                "layers": read_all(ep_out, ep_in),
            },
            indent=2,
        )
    )


def command_apply_profile(profile_json_path: str):
    _, ep_out, ep_in = open_device()
    with open(profile_json_path, "r", encoding="utf8") as handle:
        profile_layers = json.load(handle)

    for layer_number in range(1, NUM_LAYERS + 1):
        layer_data = profile_layers.get(str(layer_number), {})
        for button_name, button_id in BUTTON_NAMES.items():
            strokes = layer_data.get(button_name, [])
            keys = [
                (int(stroke.get("modifier", 0)), int(stroke.get("keycode", 0)))
                for stroke in strokes
            ]
            write_button(ep_out, button_id, layer_number, keys if keys else [(0, 0)], save=False)

    save_to_board(ep_out)
    print(json.dumps({"ok": True, "layers": read_all(ep_out, ep_in)}, indent=2))


def main():
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("read")

    write_text = subparsers.add_parser("write-text")
    write_text.add_argument("--layer", type=int, required=True)
    write_text.add_argument("--button", required=True, choices=sorted(BUTTON_NAMES.keys()))
    write_text.add_argument("--text", required=True)
    write_text.add_argument("--text-layout", default="win-uk", choices=sorted(TEXT_SYMBOLS_BY_LAYOUT.keys()))

    write_binding = subparsers.add_parser("write-binding")
    write_binding.add_argument("--layer", type=int, required=True)
    write_binding.add_argument("--button", required=True, choices=sorted(BUTTON_NAMES.keys()))
    write_binding.add_argument("--binding", required=True)
    write_binding.add_argument("--text-layout", default="win-uk", choices=sorted(TEXT_SYMBOLS_BY_LAYOUT.keys()))

    duplicate_layer = subparsers.add_parser("duplicate-layer")
    duplicate_layer.add_argument("--source-layer", type=int, required=True)
    duplicate_layer.add_argument("--target-layer", type=int, required=True)

    apply_profile = subparsers.add_parser("apply-profile")
    apply_profile.add_argument("--profile-json", required=True)

    args = parser.parse_args()

    try:
        if args.command == "read":
            command_read()
        elif args.command == "write-text":
            command_write_text(args.layer, args.button, args.text, args.text_layout)
        elif args.command == "write-binding":
            command_write_binding(args.layer, args.button, args.binding, args.text_layout)
        elif args.command == "duplicate-layer":
            command_duplicate_layer(args.source_layer, args.target_layer)
        elif args.command == "apply-profile":
            command_apply_profile(args.profile_json)
    except usb.core.USBError as error:
        fail(f"USB error: {error}")
    except Exception as error:
        fail(str(error))


if __name__ == "__main__":
    main()
