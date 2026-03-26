import { spawn } from "node:child_process";
import path from "node:path";
import type {
  DeviceDuplicateLayerRequest,
  DeviceReadResult,
  DeviceWriteBindingRequest,
  DeviceWriteTextRequest
} from "../../shared/types";

const helperPath = path.resolve(process.cwd(), "scripts", "macropad_backend.py");

interface PythonCommand {
  command: string;
  args: string[];
}

function getPythonEnvironment(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PYUSB_LIBUSB_PATH:
      process.env.PYUSB_LIBUSB_PATH ||
      "C:\\Program Files\\Elgato\\StreamDeck\\libusb-1.0.dll"
  };
}

function getPythonCandidates(): PythonCommand[] {
  const configured = process.env.MACRODECK_PYTHON?.trim();
  const candidates: PythonCommand[] = [];

  if (configured) {
    candidates.push({ command: configured, args: [] });
  }

  if (process.platform === "win32") {
    candidates.push(
      { command: "python", args: [] },
      { command: "py", args: ["-3"] },
      { command: "py", args: [] }
    );
  } else {
    candidates.push(
      { command: "python3", args: [] },
      { command: "python", args: [] }
    );
  }

  return candidates;
}

function spawnHelper(python: PythonCommand, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(python.command, [...python.args, helperPath, ...args], {
      cwd: process.cwd(),
      env: getPythonEnvironment(),
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code !== 0 && !stdout.trim()) {
        reject(new Error(stderr.trim() || `Helper exited with code ${code}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

async function runHelper(args: string[]): Promise<string> {
  const errors: string[] = [];

  for (const python of getPythonCandidates()) {
    try {
      return await spawnHelper(python, args);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${python.command}${python.args.length ? ` ${python.args.join(" ")}` : ""}: ${message}`);
    }
  }

  throw new Error(
    [
      "Unable to find a working Python runtime for the macropad helper.",
      "Set MACRODECK_PYTHON to the full path of python.exe if needed.",
      ...errors
    ].join("\n")
  );
}

export class PythonBackend {
  async readBoard(): Promise<DeviceReadResult> {
    const raw = await runHelper(["read"]);
    return JSON.parse(raw) as DeviceReadResult;
  }

  async writeText(request: DeviceWriteTextRequest): Promise<DeviceReadResult> {
    const raw = await runHelper([
      "write-text",
      "--layer",
      String(request.layer),
      "--button",
      request.button,
      "--text",
      request.text,
      "--text-layout",
      request.textLayout
    ]);
    return JSON.parse(raw) as DeviceReadResult;
  }

  async writeBinding(request: DeviceWriteBindingRequest): Promise<DeviceReadResult> {
    const raw = await runHelper([
      "write-binding",
      "--layer",
      String(request.layer),
      "--button",
      request.button,
      "--binding",
      request.binding,
      "--text-layout",
      request.textLayout
    ]);
    return JSON.parse(raw) as DeviceReadResult;
  }

  async duplicateLayer(request: DeviceDuplicateLayerRequest): Promise<DeviceReadResult> {
    const raw = await runHelper([
      "duplicate-layer",
      "--source-layer",
      String(request.sourceLayer),
      "--target-layer",
      String(request.targetLayer)
    ]);
    return JSON.parse(raw) as DeviceReadResult;
  }
}
