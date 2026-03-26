import type {
  DeviceLayer,
  DeviceProfile,
  DeviceWorkspace,
  KeyBinding,
  KnobBinding,
  MacroAction
} from "../../shared/types";

function action(id: string, type: MacroAction["type"], label: string, value: string): MacroAction {
  return { id, type, label, value };
}

function key(
  index: number,
  row: number,
  column: number,
  legend: string,
  color: string,
  actions: MacroAction[]
): KeyBinding {
  return {
    id: `key-${index}`,
    index,
    matrixIndex: index - 1,
    row,
    column,
    legend,
    color,
    actions
  };
}

function knob(id: string, legend: string, clockwise: MacroAction[], counterClockwise: MacroAction[], press?: MacroAction[]): KnobBinding {
  return {
    id,
    legend,
    clockwise,
    counterClockwise,
    press
  };
}

function workLayer(): DeviceLayer {
  return {
    id: "layer-work-base",
    name: "Base Layer",
    description: "Primary productivity shortcuts for the 3x4 matrix and dual wheels.",
    active: true,
    lighting: {
      mode: "static",
      brightness: 82,
      color: "#38bdf8",
      speed: 2
    },
    keys: [
      key(1, 0, 0, "Mail", "#fb7185", [
        action("1-open", "launch", "Open Outlook", "outlook.exe"),
        action("1-delay", "delay", "Wait 120ms", "120")
      ]),
      key(2, 0, 1, "Daily", "#f59e0b", [
        action("2-open", "launch", "Open Teams", "ms-teams.exe"),
        action("2-text", "text", "Type standup template", "Yesterday / Today / Blockers")
      ]),
      key(3, 0, 2, "Build", "#22c55e", [
        action("3-chord", "chord", "Send Ctrl+Shift+B", "Ctrl+Shift+B")
      ]),
      key(4, 1, 0, "Docs", "#38bdf8", [
        action("4-launch", "launch", "Open browser", "chrome.exe"),
        action("4-text", "text", "Open docs bookmark", "docs")
      ]),
      key(5, 1, 1, "Mute", "#14b8a6", [
        action("5-media", "media", "Toggle microphone mute", "mic-mute")
      ]),
      key(6, 1, 2, "Snip", "#8b5cf6", [
        action("6-chord", "chord", "Send Win+Shift+S", "Win+Shift+S")
      ]),
      key(7, 1, 3, "Term", "#f97316", [
        action("7-launch", "launch", "Open Windows Terminal", "wt.exe")
      ]),
      key(8, 2, 0, "Copy", "#e879f9", [
        action("8-chord", "chord", "Send Ctrl+C", "Ctrl+C")
      ]),
      key(9, 2, 1, "Paste", "#2dd4bf", [
        action("9-chord", "chord", "Send Ctrl+V", "Ctrl+V")
      ]),
      key(10, 2, 2, "Lock", "#64748b", [
        action("10-system", "system", "Lock workstation", "lock")
      ]),
      key(11, 2, 3, "Search", "#60a5fa", [
        action("11-chord", "chord", "Send Win+S", "Win+S")
      ]),
      key(12, 0, 3, "Notes", "#f43f5e", [
        action("12-launch", "launch", "Open OneNote", "onenote.exe")
      ])
    ],
    knobs: [
      knob(
        "knob-1",
        "Volume",
        [action("knob-1-cw", "media", "Volume up", "volume-up")],
        [action("knob-1-ccw", "media", "Volume down", "volume-down")],
        [action("knob-1-press", "media", "Toggle mute", "mute")]
      ),
      knob(
        "knob-2",
        "Timeline",
        [action("knob-2-cw", "mouse", "Horizontal scroll right", "wheel-right")],
        [action("knob-2-ccw", "mouse", "Horizontal scroll left", "wheel-left")],
        [action("knob-2-press", "keystroke", "Play or pause", "Space")]
      )
    ]
  };
}

function streamLayer(): DeviceLayer {
  return {
    id: "layer-stream-base",
    name: "Stream Layer",
    description: "Scene switching and capture controls for live sessions.",
    active: false,
    lighting: {
      mode: "breathing",
      brightness: 74,
      color: "#f97316",
      speed: 5
    },
    keys: [
      key(1, 0, 0, "Scene 1", "#f97316", [
        action("s1-launch", "launch", "Focus OBS", "obs64.exe"),
        action("s1-key", "keystroke", "Send F13", "F13")
      ]),
      key(2, 0, 1, "BRB", "#ef4444", [
        action("s2-key", "keystroke", "Send F14", "F14")
      ]),
      key(3, 0, 2, "Marker", "#84cc16", [
        action("s3-key", "keystroke", "Send F15", "F15")
      ]),
      key(4, 1, 0, "Clip", "#0ea5e9", [
        action("s4-key", "keystroke", "Send F16", "F16")
      ]),
      key(5, 1, 1, "Chat", "#06b6d4", [
        action("s5-launch", "launch", "Open Discord", "discord.exe")
      ]),
      key(6, 1, 2, "Music", "#a78bfa", [
        action("s6-media", "media", "Play or pause", "play-pause")
      ]),
      key(7, 1, 3, "Replay", "#22c55e", [
        action("s7-key", "keystroke", "Replay buffer", "F17")
      ]),
      key(8, 2, 0, "Mic", "#14b8a6", [
        action("s8-key", "keystroke", "Mute mic", "F18")
      ]),
      key(9, 2, 1, "Cam", "#38bdf8", [
        action("s9-key", "keystroke", "Toggle camera scene", "F19")
      ]),
      key(10, 2, 2, "Raid", "#ef4444", [
        action("s10-text", "text", "Raid message", "/raid Starting the raid now!")
      ]),
      key(11, 2, 3, "Marker+", "#f59e0b", [
        action("s11-key", "keystroke", "Add timestamp marker", "F20")
      ]),
      key(12, 0, 3, "Sponsor", "#06b6d4", [
        action("s12-text", "text", "Sponsor message", "Thanks to today's sponsor!")
      ])
    ],
    knobs: [
      knob(
        "knob-stream-1",
        "Scenes",
        [action("knob-stream-cw", "keystroke", "Next scene", "Ctrl+Alt+Right")],
        [action("knob-stream-ccw", "keystroke", "Previous scene", "Ctrl+Alt+Left")],
        [action("knob-stream-press", "keystroke", "Studio mode", "Ctrl+Alt+S")]
      ),
      knob(
        "knob-stream-2",
        "Chat",
        [action("knob-stream-2-cw", "mouse", "Scroll chat down", "wheel-down")],
        [action("knob-stream-2-ccw", "mouse", "Scroll chat up", "wheel-up")],
        [action("knob-stream-2-press", "keystroke", "Toggle chat dock", "Ctrl+Alt+C")]
      )
    ]
  };
}

function toolsLayer(): DeviceLayer {
  return {
    id: "layer-tools-base",
    name: "Tools Layer",
    description: "A third key set for utility shortcuts and system actions.",
    active: false,
    lighting: {
      mode: "reactive",
      brightness: 68,
      color: "#22c55e",
      speed: 4
    },
    keys: [
      key(1, 0, 0, "Undo", "#f59e0b", [
        action("t1", "chord", "Send Ctrl+Z", "Ctrl+Z")
      ]),
      key(2, 0, 1, "Redo", "#84cc16", [
        action("t2", "chord", "Send Ctrl+Y", "Ctrl+Y")
      ]),
      key(3, 0, 2, "Task", "#0ea5e9", [
        action("t3", "chord", "Open Task View", "Win+Tab")
      ]),
      key(4, 0, 3, "Desk", "#38bdf8", [
        action("t4", "chord", "New desktop", "Win+Ctrl+D")
      ]),
      key(5, 1, 0, "Lock", "#64748b", [
        action("t5", "system", "Lock workstation", "lock")
      ]),
      key(6, 1, 1, "Emoji", "#f472b6", [
        action("t6", "chord", "Open emoji panel", "Win+.")
      ]),
      key(7, 1, 2, "Paste+", "#a78bfa", [
        action("t7", "chord", "Paste without formatting", "Ctrl+Shift+V")
      ]),
      key(8, 1, 3, "Color", "#fb7185", [
        action("t8", "launch", "Open PowerToys Color Picker", "PowerToys.ColorPicker")
      ]),
      key(9, 2, 0, "Calc", "#14b8a6", [
        action("t9", "launch", "Open Calculator", "calc.exe")
      ]),
      key(10, 2, 1, "Files", "#2dd4bf", [
        action("t10", "launch", "Open File Explorer", "explorer.exe")
      ]),
      key(11, 2, 2, "Search", "#60a5fa", [
        action("t11", "chord", "Windows search", "Win+S")
      ]),
      key(12, 2, 3, "Sleep", "#ef4444", [
        action("t12", "system", "Sleep PC", "sleep")
      ])
    ],
    knobs: [
      knob(
        "knob-tools-1",
        "Zoom",
        [action("kt1-cw", "chord", "Zoom in", "Ctrl++")],
        [action("kt1-ccw", "chord", "Zoom out", "Ctrl+-")],
        [action("kt1-press", "chord", "Reset zoom", "Ctrl+0")]
      ),
      knob(
        "knob-tools-2",
        "Desktop",
        [action("kt2-cw", "chord", "Next desktop", "Win+Ctrl+Right")],
        [action("kt2-ccw", "chord", "Previous desktop", "Win+Ctrl+Left")],
        [action("kt2-press", "chord", "Task view", "Win+Tab")]
      )
    ]
  };
}

function createProfiles(): DeviceProfile[] {
  return [
    {
      id: "work",
      name: "Workday",
      description: "A CH57x-style 3x4 matrix with two clickable wheels and three switchable key sets.",
      active: true,
      layout: {
        orientation: "landscape",
        rows: 3,
        columns: 4,
        knobCount: 2
      },
      layers: [workLayer(), streamLayer(), toolsLayer()]
    }
  ];
}

export function createMockWorkspace(vendorId: number, productId: number): DeviceWorkspace {
  return {
    device: {
      id: "vid_1189_pid_8840_mi_01_col03",
      name: "CH57x Macro Keyboard",
      connection: "usb",
      vendorId,
      productId,
      interfaceNumber: 1,
      pathHint: "MI_01 / Col03",
      firmware: "Unknown",
      usagePage: 0x01,
      usage: 0x06,
      serialNumber: null,
      manufacturer: "Unknown",
      product: "CH57x Keyboard Family",
      status: "mock",
      transport: "mock",
      family: "ch57x"
    },
    profiles: createProfiles(),
    diagnostics: [
      "Showing CH57x-style mock data until a matching programmable interface is confirmed.",
      "Target family: CH57x keyboard tools list 0x1189:0x8840 as supported.",
      "Modeled as a 3x4 matrix with two clickable wheels and three onboard layers.",
      "Next step: verify whether uploads happen over HID only or a separate USB transport."
    ]
  };
}
