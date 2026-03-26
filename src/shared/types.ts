export type MacroActionType =
  | "keystroke"
  | "chord"
  | "text"
  | "launch"
  | "delay"
  | "system"
  | "media"
  | "mouse";

export interface MacroAction {
  id: string;
  type: MacroActionType;
  label: string;
  value: string;
}

export interface DeviceMacroStroke {
  modifier: number;
  keycode: number;
  key: string;
}

export interface LightingConfig {
  mode: "static" | "breathing" | "reactive" | "off";
  brightness: number;
  color: string;
  speed: number;
}

export interface KeyBinding {
  id: string;
  index: number;
  matrixIndex: number;
  row: number;
  column: number;
  legend: string;
  color: string;
  actions: MacroAction[];
  strokes?: DeviceMacroStroke[];
}

export interface KnobBinding {
  id: string;
  legend: string;
  clockwise: MacroAction[];
  counterClockwise: MacroAction[];
  press?: MacroAction[];
  clockwiseStrokes?: DeviceMacroStroke[];
  counterClockwiseStrokes?: DeviceMacroStroke[];
  pressStrokes?: DeviceMacroStroke[];
}

export interface LayoutDefinition {
  orientation: "portrait" | "landscape";
  rows: number;
  columns: number;
  knobCount: number;
}

export interface DeviceLayer {
  id: string;
  name: string;
  description: string;
  active: boolean;
  lighting: LightingConfig;
  keys: KeyBinding[];
  knobs: KnobBinding[];
}

export interface DeviceProfile {
  id: string;
  name: string;
  description: string;
  active: boolean;
  layout: LayoutDefinition;
  layers: DeviceLayer[];
}

export interface DeviceSummary {
  id: string;
  name: string;
  connection: "usb";
  vendorId: number;
  productId: number;
  interfaceNumber: number;
  pathHint: string;
  firmware: string;
  usagePage?: number | null;
  usage?: number | null;
  serialNumber?: string | null;
  manufacturer?: string | null;
  product?: string | null;
  status: "connected" | "mock" | "unavailable";
  transport: "hid" | "mock";
  family: "ch57x" | "generic";
}

export interface DeviceWorkspace {
  device: DeviceSummary;
  profiles: DeviceProfile[];
  diagnostics: string[];
}

export interface DeviceReadResult {
  ok: boolean;
  layers?: Record<string, Record<string, DeviceMacroStroke[]>>;
  error?: string;
  layer?: number;
  button?: string;
  text?: string;
  readback?: Array<[number, number]>;
}

export type TextLayoutTarget = "win-uk" | "win-us" | "mac-uk" | "mac-us";

export interface DeviceWriteTextRequest {
  layer: number;
  button: string;
  text: string;
  textLayout: TextLayoutTarget;
}

export interface DeviceWriteBindingRequest {
  layer: number;
  button: string;
  binding: string;
}

export interface DeviceDuplicateLayerRequest {
  sourceLayer: number;
  targetLayer: number;
}
