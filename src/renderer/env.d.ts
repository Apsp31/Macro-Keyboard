/// <reference types="vite/client" />

import type { DeviceWorkspace } from "../shared/types";

interface MacroDeckApi {
  listWorkspaces(): Promise<DeviceWorkspace[]>;
  refreshWorkspaces(): Promise<DeviceWorkspace[]>;
  readBoard(): Promise<DeviceWorkspace[]>;
  writeText(request: import("../shared/types").DeviceWriteTextRequest): Promise<DeviceWorkspace[]>;
  writeBinding(request: import("../shared/types").DeviceWriteBindingRequest): Promise<DeviceWorkspace[]>;
  duplicateLayer(request: import("../shared/types").DeviceDuplicateLayerRequest): Promise<DeviceWorkspace[]>;
}

declare global {
  interface Window {
    macroDeck: MacroDeckApi;
  }
}

export {};
