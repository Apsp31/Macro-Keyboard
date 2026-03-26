import type {
  DeviceDuplicateLayerRequest,
  MacroAction,
  DeviceMacroStroke,
  DeviceReadResult,
  SavedBoardProfile,
  DeviceSummary,
  DeviceWorkspace,
  DeviceWriteBindingRequest,
  DeviceWriteTextRequest,
  KeyBinding,
  KnobBinding
} from "../../shared/types";
import { createMockWorkspace } from "./mockWorkspace";
import { PythonBackend } from "./pythonBackend";

const TARGET_VENDOR_ID = 0x1189;
const TARGET_PRODUCT_ID = 0x8840;

interface HidDeviceLike {
  vendorId: number;
  productId: number;
  path?: string;
  interface?: number;
  usagePage?: number;
  usage?: number;
  manufacturer?: string;
  product?: string;
  serialNumber?: string;
  release?: number;
}

export class DeviceService {
  private readonly pythonBackend = new PythonBackend();

  async listWorkspaces(): Promise<DeviceWorkspace[]> {
    const diagnostics: string[] = [];

    try {
      const hidModule = await import("node-hid");
      const devices = this.readDevices(hidModule).filter((device) =>
        device.vendorId === TARGET_VENDOR_ID && device.productId === TARGET_PRODUCT_ID
      );

      if (devices.length === 0) {
        const mockWorkspace = createMockWorkspace(TARGET_VENDOR_ID, TARGET_PRODUCT_ID);
        mockWorkspace.diagnostics = [
          "No matching HID interfaces are currently visible to node-hid.",
          "Connect the device, then press Refresh Devices to re-scan."
        ];
        return [mockWorkspace];
      }

      diagnostics.push(`Found ${devices.length} matching HID interface(s).`);

      return devices
        .sort((left, right) => this.rankDevice(right) - this.rankDevice(left))
        .map((device, index) => this.createWorkspace(device, diagnostics, index));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const mockWorkspace = createMockWorkspace(TARGET_VENDOR_ID, TARGET_PRODUCT_ID);
      mockWorkspace.device.status = "unavailable";
      mockWorkspace.diagnostics = [
        "Real HID enumeration is unavailable right now.",
        `node-hid failed to load: ${message}`
      ];
      return [mockWorkspace];
    }
  }

  async readBoardWorkspace(): Promise<DeviceWorkspace[]> {
    const workspaces = await this.listWorkspaces();
    const readResult = await this.pythonBackend.readBoard();
    if (!readResult.ok || !readResult.layers) {
      workspaces[0].diagnostics.unshift(readResult.error ?? "Board read failed.");
      return workspaces;
    }

    return workspaces.map((workspace) => this.applyReadResult(workspace, readResult));
  }

  async writeTextToButton(request: DeviceWriteTextRequest): Promise<DeviceWorkspace[]> {
    await this.pythonBackend.writeText(request);
    return this.readBoardWorkspace();
  }

  async writeBindingToButton(request: DeviceWriteBindingRequest): Promise<DeviceWorkspace[]> {
    await this.pythonBackend.writeBinding(request);
    return this.readBoardWorkspace();
  }

  async duplicateLayer(request: DeviceDuplicateLayerRequest): Promise<DeviceWorkspace[]> {
    await this.pythonBackend.duplicateLayer(request);
    return this.readBoardWorkspace();
  }

  async applySavedProfile(profile: SavedBoardProfile): Promise<DeviceWorkspace[]> {
    await this.pythonBackend.applyProfile(profile.layers);
    return this.readBoardWorkspace();
  }

  private readDevices(hidModule: unknown): HidDeviceLike[] {
    if (
      typeof hidModule === "object" &&
      hidModule !== null &&
      "devices" in hidModule &&
      typeof (hidModule as { devices?: () => HidDeviceLike[] }).devices === "function"
    ) {
      return (hidModule as { devices: () => HidDeviceLike[] }).devices();
    }

    if (
      typeof hidModule === "object" &&
      hidModule !== null &&
      "default" in hidModule &&
      typeof (hidModule as { default?: { devices?: () => HidDeviceLike[] } }).default?.devices === "function"
    ) {
      return (hidModule as { default: { devices: () => HidDeviceLike[] } }).default.devices();
    }

    throw new Error("Unsupported node-hid module shape");
  }

  private createWorkspace(device: HidDeviceLike, diagnostics: string[], index: number): DeviceWorkspace {
    const workspace = createMockWorkspace(TARGET_VENDOR_ID, TARGET_PRODUCT_ID);
    workspace.device = this.toDeviceSummary(device, index);
    workspace.diagnostics = [
      ...diagnostics,
      `Selected HID path: ${device.path ?? "unknown path"}`,
      `Usage page ${this.formatHex(device.usagePage)} / usage ${this.formatHex(device.usage)}`
    ];
    return workspace;
  }

  private toDeviceSummary(device: HidDeviceLike, index: number): DeviceSummary {
    const interfaceNumber = device.interface ?? index;

    return {
      id: device.path ?? `hid-${TARGET_VENDOR_ID}-${TARGET_PRODUCT_ID}-${interfaceNumber}`,
      name: device.product || "Generic Macro Keyboard",
      connection: "usb",
      vendorId: device.vendorId,
      productId: device.productId,
      interfaceNumber,
      pathHint: this.describePath(device),
      firmware: device.release ? `0x${device.release.toString(16).toUpperCase()}` : "Unknown",
      usagePage: device.usagePage ?? null,
      usage: device.usage ?? null,
      serialNumber: device.serialNumber ?? null,
      manufacturer: device.manufacturer ?? null,
      product: device.product ?? null,
      status: "connected",
      transport: "hid",
      family: "ch57x"
    };
  }

  private describePath(device: HidDeviceLike): string {
    const interfaceLabel = device.interface !== undefined ? `Interface ${device.interface}` : "Interface ?";
    const usageLabel =
      device.usagePage !== undefined || device.usage !== undefined
        ? `Usage ${this.formatHex(device.usagePage)}:${this.formatHex(device.usage)}`
        : "Usage unknown";

    return `${interfaceLabel} / ${usageLabel}`;
  }

  private rankDevice(device: HidDeviceLike): number {
    let score = 0;

    if (device.interface === 1) {
      score += 5;
    }

    if (device.usagePage === 0x01) {
      score += 3;
    }

    if (device.usage === 0x06) {
      score += 2;
    }

    return score;
  }

  private formatHex(value: number | undefined): string {
    if (value === undefined) {
      return "unknown";
    }

    return `0x${value.toString(16).toUpperCase()}`;
  }

  private applyReadResult(workspace: DeviceWorkspace, readResult: DeviceReadResult): DeviceWorkspace {
    const nextWorkspace: DeviceWorkspace = {
      ...workspace,
      profiles: workspace.profiles.map((profile) => ({
        ...profile,
        layers: profile.layers.map((layer, index) => {
          const layerNumber = String(index + 1);
          const layerData = readResult.layers?.[layerNumber] ?? {};
          return {
            ...layer,
            keys: layer.keys.map((key) => this.applyKeyRead(key, layerData[`key${key.index}`] ?? [])),
            knobs: layer.knobs.map((knob, knobIndex) => this.applyKnobRead(knob, knobIndex + 1, layerData))
          };
        })
      })),
      diagnostics: [
        "Board read completed successfully.",
        ...workspace.diagnostics
      ]
    };

    return nextWorkspace;
  }

  private applyKeyRead(key: KeyBinding, strokes: DeviceMacroStroke[]): KeyBinding {
    return {
      ...key,
      legend: `Key ${key.index}`,
      strokes,
      actions: this.strokesToActions(strokes)
    };
  }

  private applyKnobRead(knob: KnobBinding, knobNumber: number, layerData: Record<string, DeviceMacroStroke[]>): KnobBinding {
    const left = layerData[`knob${knobNumber}_left`] ?? [];
    const right = layerData[`knob${knobNumber}_right`] ?? [];
    const press = layerData[`knob${knobNumber}_press`] ?? [];

    return {
      ...knob,
      legend: `Wheel ${knobNumber}`,
      counterClockwiseStrokes: left,
      pressStrokes: press,
      clockwiseStrokes: right,
      counterClockwise: this.strokesToActions(left),
      press: this.strokesToActions(press),
      clockwise: this.strokesToActions(right)
    };
  }

  private strokesToActions(strokes: DeviceMacroStroke[]): MacroAction[] {
    return strokes.map((stroke, index) => {
      const type: MacroAction["type"] = stroke.modifier ? "chord" : "keystroke";

      return {
      id: `stroke-${index}-${stroke.keycode}`,
      type,
      label: stroke.modifier ? `Modified ${stroke.key}` : `Key ${stroke.key}`,
      value: this.describeStroke(stroke)
      };
    });
  }

  private describeStroke(stroke: DeviceMacroStroke): string {
    const parts: string[] = [];
    if (stroke.modifier & 0x01) {
      parts.push("Ctrl");
    }
    if (stroke.modifier & 0x02) {
      parts.push("Shift");
    }
    if (stroke.modifier & 0x04) {
      parts.push("Alt");
    }
    if (stroke.modifier & 0x08) {
      parts.push("Meta");
    }
    parts.push(stroke.key);
    return parts.join("+");
  }
}
