import { contextBridge, ipcRenderer } from "electron";
import type {
  DeviceDuplicateLayerRequest,
  DeviceWorkspace,
  DeviceWriteBindingRequest,
  DeviceWriteTextRequest
} from "../shared/types";

const api = {
  listWorkspaces: (): Promise<DeviceWorkspace[]> => ipcRenderer.invoke("device:list-workspaces"),
  refreshWorkspaces: (): Promise<DeviceWorkspace[]> => ipcRenderer.invoke("device:refresh-workspaces"),
  readBoard: (): Promise<DeviceWorkspace[]> => ipcRenderer.invoke("device:read-board"),
  writeText: (request: DeviceWriteTextRequest): Promise<DeviceWorkspace[]> => ipcRenderer.invoke("device:write-text", request),
  writeBinding: (request: DeviceWriteBindingRequest): Promise<DeviceWorkspace[]> => ipcRenderer.invoke("device:write-binding", request),
  duplicateLayer: (request: DeviceDuplicateLayerRequest): Promise<DeviceWorkspace[]> => ipcRenderer.invoke("device:duplicate-layer", request)
};

contextBridge.exposeInMainWorld("macroDeck", api);

declare global {
  interface Window {
    macroDeck: typeof api;
  }
}
