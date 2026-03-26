/// <reference types="vite/client" />

import type { AppSettings, DeviceWorkspace } from "../shared/types";

interface MacroDeckApi {
  listWorkspaces(): Promise<DeviceWorkspace[]>;
  refreshWorkspaces(): Promise<DeviceWorkspace[]>;
  readBoard(): Promise<DeviceWorkspace[]>;
  writeText(request: import("../shared/types").DeviceWriteTextRequest): Promise<DeviceWorkspace[]>;
  writeBinding(request: import("../shared/types").DeviceWriteBindingRequest): Promise<DeviceWorkspace[]>;
  duplicateLayer(request: import("../shared/types").DeviceDuplicateLayerRequest): Promise<DeviceWorkspace[]>;
  loadSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<AppSettings>;
}

declare global {
  interface Window {
    macroDeck: MacroDeckApi;
  }
}

export {};
