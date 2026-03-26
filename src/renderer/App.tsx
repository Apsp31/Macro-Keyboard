import { useEffect, useState } from "react";
import packageJson from "../../package.json";
import type {
  DeviceLayer,
  DeviceMacroStroke,
  DeviceProfile,
  DeviceDuplicateLayerRequest,
  DeviceWorkspace,
  KeyBinding,
  KnobBinding,
  MacroAction,
  TextLayoutTarget
} from "@shared/types";
const LABEL_STORAGE_KEY = "macrodeck-label-overrides";
const LAYER_NAME_STORAGE_KEY = "macrodeck-layer-name-overrides";
const LAYER_TARGET_STORAGE_KEY = "macrodeck-layer-targets";
const MODIFIER_PICKER = [
  { id: "ctrl", label: "Ctrl" },
  { id: "shift", label: "Shift" },
  { id: "alt", label: "Alt" },
  { id: "win", label: "Win" }
] as const;
const KEY_GROUPS = [
  { title: "Common", keys: ["enter", "tab", "esc", "space", "backspace", "delete"] },
  { title: "Navigation", keys: ["up", "down", "left", "right", "home", "end", "pageup", "pagedown"] },
  { title: "Media", keys: ["mute", "volume_up", "volume_down"] },
  { title: "Letters", keys: "abcdefghijklmnopqrstuvwxyz".split("") },
  { title: "Numbers", keys: "1234567890".split("") },
  { title: "Function", keys: Array.from({ length: 24 }, (_, index) => `f${index + 1}`) }
] as const;
const TEXT_LAYOUT_OPTIONS: Array<{ value: TextLayoutTarget; label: string }> = [
  { value: "win-uk", label: "Windows UK" },
  { value: "win-us", label: "Windows US" },
  { value: "mac-uk", label: "macOS UK" },
  { value: "mac-us", label: "macOS US" }
];
type WheelPart = "clockwise" | "counterClockwise" | "press";

function formatHex(value: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(4, "0")}`;
}

function strokeToDisplay(stroke: DeviceMacroStroke): string {
  const modifiers: string[] = [];
  if (stroke.modifier & 0x01) {
    modifiers.push("Ctrl");
  }
  if (stroke.modifier & 0x02) {
    modifiers.push("Shift");
  }
  if (stroke.modifier & 0x04) {
    modifiers.push("Alt");
  }
  if (stroke.modifier & 0x08) {
    modifiers.push("Meta");
  }

  return modifiers.length ? `${modifiers.join("+")}+${stroke.key}` : stroke.key;
}

function summarizeStrokes(strokes: DeviceMacroStroke[] | undefined): string {
  if (!strokes?.length) {
    return "No action";
  }

  const printable = strokes.every((stroke) => {
    const isSimpleAlpha = /^[a-z]$/i.test(stroke.key);
    const isSimpleDigit = /^[0-9]$/.test(stroke.key);
    return stroke.modifier === 0 || (stroke.modifier === 0x02 && isSimpleAlpha) || isSimpleDigit;
  });

  if (printable) {
    return strokes
      .map((stroke) => (stroke.modifier === 0x02 ? stroke.key.toUpperCase() : stroke.key))
      .join("");
  }

  return strokes.map(strokeToDisplay).join(", ");
}

function ActionList({ actions }: { actions: MacroAction[] | undefined }) {
  if (!actions?.length) {
    return <p className="empty-state">No actions assigned yet.</p>;
  }

  return (
    <div className="action-list">
      {actions.map((action) => (
        <div key={action.id} className="action-row">
          <span className="action-type">{action.type}</span>
          <div>
            <strong>{action.label}</strong>
            <p>{action.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function KeyTile({ binding, label, selected, onSelect }: {
  binding: KeyBinding;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const summary = summarizeStrokes(binding.strokes);

  return (
    <button
      className={`key-tile ${selected ? "selected" : ""}`}
      onClick={onSelect}
      type="button"
    >
      <span className="key-accent" style={{ background: binding.color }} />
      <span className="key-position">R{binding.row + 1} C{binding.column + 1}</span>
      <span className="key-label">{label}</span>
      <span className="key-meta">{summary}</span>
    </button>
  );
}

function KnobCard({ knob, selected, onSelect }: {
  knob: KnobBinding;
  selected: boolean;
  onSelect: () => void;
}) {
  const clockwise = summarizeStrokes(knob.clockwiseStrokes);
  const counterClockwise = summarizeStrokes(knob.counterClockwiseStrokes);

  return (
    <button
      className={`knob-card ${selected ? "selected" : ""}`}
      onClick={onSelect}
      type="button"
    >
      <span className="knob-title">{knob.legend}</span>
      <span className="knob-meta">Click-scroll wheel</span>
      <span className="knob-hint">
        {clockwise} / {counterClockwise}
      </span>
    </button>
  );
}

function buildBindingToken(modifiers: string[], key: string): string {
  return [...modifiers, key].join("+");
}

export function App() {
  const appVersion = packageJson.version;
  const [workspaces, setWorkspaces] = useState<DeviceWorkspace[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [selectedLayerId, setSelectedLayerId] = useState<string>("");
  const [selectedKeyId, setSelectedKeyId] = useState<string>("");
  const [selectedKnobId, setSelectedKnobId] = useState<string>("");
  const [selectedEditor, setSelectedEditor] = useState<"key" | "wheel">("key");
  const [selectedWheelPart, setSelectedWheelPart] = useState<WheelPart>("clockwise");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isReadingBoard, setIsReadingBoard] = useState(false);
  const [isWritingText, setIsWritingText] = useState(false);
  const [writeMode, setWriteMode] = useState<"text" | "binding">("text");
  const [textDraft, setTextDraft] = useState("TEST");
  const [bindingDraft, setBindingDraft] = useState("enter");
  const [bindingSearch, setBindingSearch] = useState("");
  const [activeModifiers, setActiveModifiers] = useState<string[]>([]);
  const [labelDraft, setLabelDraft] = useState("");
  const [layerNameDraft, setLayerNameDraft] = useState("");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [labelOverrides, setLabelOverrides] = useState<Record<string, string>>({});
  const [layerNameOverrides, setLayerNameOverrides] = useState<Record<string, string>>({});
  const [layerTargets, setLayerTargets] = useState<Record<string, TextLayoutTarget>>({});
  const [duplicateTargetLayerId, setDuplicateTargetLayerId] = useState("");

  useEffect(() => {
    const raw = window.localStorage.getItem(LABEL_STORAGE_KEY);
    if (raw) {
      try {
        setLabelOverrides(JSON.parse(raw) as Record<string, string>);
      } catch {
        window.localStorage.removeItem(LABEL_STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    const raw = window.localStorage.getItem(LAYER_NAME_STORAGE_KEY);
    if (raw) {
      try {
        setLayerNameOverrides(JSON.parse(raw) as Record<string, string>);
      } catch {
        window.localStorage.removeItem(LAYER_NAME_STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    const raw = window.localStorage.getItem(LAYER_TARGET_STORAGE_KEY);
    if (raw) {
      try {
        setLayerTargets(JSON.parse(raw) as Record<string, TextLayoutTarget>);
      } catch {
        window.localStorage.removeItem(LAYER_TARGET_STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(LABEL_STORAGE_KEY, JSON.stringify(labelOverrides));
  }, [labelOverrides]);

  useEffect(() => {
    window.localStorage.setItem(LAYER_NAME_STORAGE_KEY, JSON.stringify(layerNameOverrides));
  }, [layerNameOverrides]);

  useEffect(() => {
    window.localStorage.setItem(LAYER_TARGET_STORAGE_KEY, JSON.stringify(layerTargets));
  }, [layerTargets]);

  const getLabelKey = (layerId: string | undefined, keyId: string | undefined) =>
    workspace && selectedProfile && layerId && keyId
      ? [
          workspace.device.serialNumber ?? workspace.device.id,
          selectedProfile.id,
          layerId,
          keyId
        ].join(":")
      : "";

  const getDisplayLabel = (layerId: string | undefined, key: KeyBinding | undefined) => {
    const override = labelOverrides[getLabelKey(layerId, key?.id)];
    return override || key?.legend || "Key";
  };
  const getLayerNameKey = (layerId: string | undefined) =>
    workspace && selectedProfile && layerId
      ? [
          workspace.device.serialNumber ?? workspace.device.id,
          selectedProfile.id,
          layerId
        ].join(":")
      : "";
  const getDisplayLayerName = (layer: DeviceLayer | undefined) =>
    layerNameOverrides[getLayerNameKey(layer?.id)] || layer?.name || "Layer";

  const getBoardLabel = (key: KeyBinding | undefined) => key?.legend || "Key";
  const getLayerTarget = (layerId: string | undefined): TextLayoutTarget =>
    (layerId ? layerTargets[layerId] : undefined) ?? "win-uk";
  const getWheelButtonName = (knob: KnobBinding | undefined, part: WheelPart): string | null => {
    if (!knob) {
      return null;
    }

    const knobNumber = knob.id.includes("2") ? 2 : 1;
    if (part === "clockwise") {
      return `knob${knobNumber}_right`;
    }
    if (part === "counterClockwise") {
      return `knob${knobNumber}_left`;
    }
    return `knob${knobNumber}_press`;
  };
  const getSelectedWheelStrokes = (knob: KnobBinding | undefined, part: WheelPart) => {
    if (!knob) {
      return undefined;
    }
    if (part === "clockwise") {
      return knob.clockwiseStrokes;
    }
    if (part === "counterClockwise") {
      return knob.counterClockwiseStrokes;
    }
    return knob.pressStrokes;
  };
  const getSelectedWheelActions = (knob: KnobBinding | undefined, part: WheelPart) => {
    if (!knob) {
      return undefined;
    }
    if (part === "clockwise") {
      return knob.clockwise;
    }
    if (part === "counterClockwise") {
      return knob.counterClockwise;
    }
    return knob.press;
  };

  const workspace = workspaces[0];
  const selectedProfile: DeviceProfile | undefined =
    workspace?.profiles.find((profile) => profile.id === selectedProfileId) ?? workspace?.profiles[0];
  const selectedLayer: DeviceLayer | undefined =
    selectedProfile?.layers.find((layer) => layer.id === selectedLayerId) ?? selectedProfile?.layers[0];
  const selectedKey: KeyBinding | undefined =
    selectedLayer?.keys.find((binding) => binding.id === selectedKeyId) ?? selectedLayer?.keys[0];
  const selectedKnob: KnobBinding | undefined =
    selectedLayer?.knobs.find((knob) => knob.id === selectedKnobId) ?? selectedLayer?.knobs[0];

  const applyWorkspaces = (result: DeviceWorkspace[]) => {
    setWorkspaces(result);
    const firstProfile = result[0]?.profiles[0];
    if (!firstProfile) {
      return;
    }

    const resolvedProfile =
      result[0]?.profiles.find((profile) => profile.id === selectedProfileId) ?? firstProfile;
    const resolvedLayer =
      resolvedProfile.layers.find((layer) => layer.id === selectedLayerId) ?? resolvedProfile.layers[0];

    setSelectedProfileId(resolvedProfile.id);
    setSelectedLayerId(resolvedLayer?.id ?? "");
    setSelectedKeyId((current) =>
      resolvedLayer?.keys.some((binding) => binding.id === current) ? current : (resolvedLayer?.keys[0]?.id ?? "")
    );
    setSelectedKnobId((current) =>
      resolvedLayer?.knobs.some((knob) => knob.id === current) ? current : (resolvedLayer?.knobs[0]?.id ?? "")
    );
    setSelectedEditor("key");
    setSelectedWheelPart("clockwise");
  };

  useEffect(() => {
    void window.macroDeck
      .readBoard()
      .then((result) => {
        applyWorkspaces(result);
        setStatusMessage("Board config loaded.");
      })
      .catch(async () => {
        const result = await window.macroDeck.listWorkspaces();
        applyWorkspaces(result);
      });
  }, []);

  useEffect(() => {
    setLabelDraft(getDisplayLabel(selectedLayerId, selectedKey));
  }, [selectedKey?.id, selectedLayerId, labelOverrides]);

  useEffect(() => {
    setLayerNameDraft(getDisplayLayerName(selectedLayer));
  }, [selectedLayer?.id, layerNameOverrides]);

  useEffect(() => {
    const fallback =
      selectedProfile?.layers.find((layer) => layer.id !== selectedLayerId)?.id ?? "";
    setDuplicateTargetLayerId((current) =>
      current && current !== selectedLayerId ? current : fallback
    );
  }, [selectedLayerId, selectedProfile?.id]);

  const refreshDevices = async () => {
    setIsRefreshing(true);
    setStatusMessage("");
    try {
      const result = await window.macroDeck.refreshWorkspaces();
      applyWorkspaces(result);
    } finally {
      setIsRefreshing(false);
    }
  };

  const readBoard = async () => {
    setIsReadingBoard(true);
    setStatusMessage("");
    try {
      const result = await window.macroDeck.readBoard();
      applyWorkspaces(result);
      setStatusMessage("Board config loaded.");
    } finally {
      setIsReadingBoard(false);
    }
  };

  const writeTextToSelectedKey = async () => {
    if (!selectedKey || !selectedLayer || !textDraft.trim()) {
      return;
    }

    const layerNumber =
      (selectedProfile?.layers.findIndex((layer) => layer.id === selectedLayer.id) ?? 0) + 1;

    setIsWritingText(true);
    setStatusMessage("");
    try {
      const result = await window.macroDeck.writeText({
        layer: layerNumber,
        button: `key${selectedKey.index}`,
        text: textDraft,
        textLayout: getLayerTarget(selectedLayer.id)
      });
      applyWorkspaces(result);
      setStatusMessage(`Wrote text to ${getDisplayLabel(selectedLayer?.id, selectedKey)}.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsWritingText(false);
    }
  };

  const writeBindingToSelectedKey = async () => {
    if (!selectedKey || !selectedLayer || !bindingDraft.trim()) {
      return;
    }

    const layerNumber =
      (selectedProfile?.layers.findIndex((layer) => layer.id === selectedLayer.id) ?? 0) + 1;

    setIsWritingText(true);
    setStatusMessage("");
    try {
      const result = await window.macroDeck.writeBinding({
        layer: layerNumber,
        button: `key${selectedKey.index}`,
        binding: bindingDraft
      });
      applyWorkspaces(result);
      setStatusMessage(`Wrote binding to ${getDisplayLabel(selectedLayer?.id, selectedKey)}.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsWritingText(false);
    }
  };

  const writeBindingToSelectedWheel = async () => {
    if (!selectedKnob || !selectedLayer || !bindingDraft.trim()) {
      return;
    }

    const button = getWheelButtonName(selectedKnob, selectedWheelPart);
    if (!button) {
      return;
    }

    const layerNumber =
      (selectedProfile?.layers.findIndex((layer) => layer.id === selectedLayer.id) ?? 0) + 1;

    setIsWritingText(true);
    setStatusMessage("");
    try {
      const result = await window.macroDeck.writeBinding({
        layer: layerNumber,
        button,
        binding: bindingDraft
      });
      applyWorkspaces(result);
      setStatusMessage(`Wrote ${selectedKnob.legend} ${selectedWheelPart} binding.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsWritingText(false);
    }
  };

  const saveLabel = () => {
    if (!selectedKey || !selectedLayer) {
      return;
    }

    const storageKey = getLabelKey(selectedLayer.id, selectedKey.id);
    setLabelOverrides((current) => ({
      ...current,
      [storageKey]: labelDraft.trim() || selectedKey.legend
    }));
    setStatusMessage("Saved label in app.");
  };

  const saveLayerName = () => {
    if (!selectedLayer) {
      return;
    }

    const storageKey = getLayerNameKey(selectedLayer.id);
    setLayerNameOverrides((current) => ({
      ...current,
      [storageKey]: layerNameDraft.trim() || selectedLayer.name
    }));
    setStatusMessage("Saved layer name in app.");
  };

  const appendBindingToken = (key: string) => {
    const token = buildBindingToken(activeModifiers, key);
    setBindingDraft((current) => (current.trim() ? `${current.trim()}, ${token}` : token));
    setActiveModifiers([]);
  };

  const filteredGroups = KEY_GROUPS.map((group) => ({
    ...group,
    keys: group.keys.filter((key) => key.includes(bindingSearch.trim().toLowerCase()))
  })).filter((group) => group.keys.length > 0);

  const duplicateLayerToTarget = async () => {
    if (!selectedLayer || !selectedProfile || !duplicateTargetLayerId || duplicateTargetLayerId === selectedLayer.id) {
      return;
    }

    const sourceLayer =
      (selectedProfile.layers.findIndex((layer) => layer.id === selectedLayer.id) ?? 0) + 1;
    const targetLayer =
      (selectedProfile.layers.findIndex((layer) => layer.id === duplicateTargetLayerId) ?? 0) + 1;

    setIsWritingText(true);
    setStatusMessage("");
    try {
      const request: DeviceDuplicateLayerRequest = { sourceLayer, targetLayer };
      const result = await window.macroDeck.duplicateLayer(request);
      setLayerTargets((current) => ({
        ...current,
        [duplicateTargetLayerId]: getLayerTarget(selectedLayer.id)
      }));
      applyWorkspaces(result);
      setStatusMessage(`Copied ${selectedLayer.name} to layer ${targetLayer}.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsWritingText(false);
    }
  };

  return (
    <main className="app-shell">
      <section className="content-grid">
        <aside className="sidebar-card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">Config</p>
              <h2>{workspace?.device.name ?? "Searching..."}</h2>
              <p className="panel-version">MacroDeck Studio v{appVersion}</p>
            </div>
            <span className={`status-chip ${workspace?.device.status ?? "mock"}`}>
              {workspace?.device.status ?? "mock"}
            </span>
          </div>

          <dl className="spec-list">
            <div>
              <dt>VID / PID</dt>
              <dd>
                {workspace ? `${formatHex(workspace.device.vendorId)} / ${formatHex(workspace.device.productId)}` : "Unknown"}
              </dd>
            </div>
            <div>
              <dt>Layout</dt>
              <dd>
                {selectedProfile
                  ? `${selectedProfile.layout.rows}x${selectedProfile.layout.columns}, ${selectedProfile.layout.knobCount} wheels, ${selectedProfile.layers.length} layers`
                  : "Unknown"}
              </dd>
            </div>
            <div>
              <dt>Family</dt>
              <dd>{workspace?.device.family.toUpperCase() ?? "UNKNOWN"}</dd>
            </div>
            <div>
              <dt>Connection</dt>
              <dd>
                {workspace?.device.connection.toUpperCase() ?? "USB"} / {workspace?.device.transport.toUpperCase() ?? "MOCK"}
              </dd>
            </div>
            <div>
              <dt>Maker</dt>
              <dd>{workspace?.device.manufacturer ?? "Unknown"}</dd>
            </div>
            <div>
              <dt>Usage</dt>
              <dd>
                {workspace?.device.usagePage !== null && workspace?.device.usagePage !== undefined
                  ? `${formatHex(workspace.device.usagePage)} / ${formatHex(workspace.device.usage ?? 0)}`
                  : "Unknown"}
              </dd>
            </div>
            <div>
              <dt>Windows Path</dt>
              <dd>{workspace?.device.id ?? "Pending detection"}</dd>
            </div>
          </dl>

          <button className="secondary-button full-width" onClick={() => void refreshDevices()} type="button">
            {isRefreshing ? "Refreshing..." : "Refresh Devices"}
          </button>

          <button className="secondary-button full-width" onClick={() => void readBoard()} type="button">
            {isReadingBoard ? "Reading Board..." : "Read Board Config"}
          </button>

          <div className="diagnostics-panel">
            <p className="eyebrow">Diagnostics</p>
            {(workspace?.diagnostics ?? ["No diagnostics yet."]).map((line) => (
              <p key={line} className="diagnostic-line">{line}</p>
            ))}
            {statusMessage ? <p className="diagnostic-line strong-copy">{statusMessage}</p> : null}
          </div>

          <div className="profile-list">
            <p className="eyebrow">Profiles</p>
            {workspace?.profiles.map((profile) => (
              <button
                key={profile.id}
                className={`profile-row ${selectedProfile?.id === profile.id ? "active" : ""}`}
                onClick={() => {
                  setSelectedProfileId(profile.id);
                  setSelectedLayerId(profile.layers[0]?.id ?? "");
                  setSelectedKeyId(profile.layers[0]?.keys[0]?.id ?? "");
                  setSelectedKnobId(profile.layers[0]?.knobs[0]?.id ?? "");
                  setSelectedEditor("key");
                }}
                type="button"
              >
                <span>
                  <strong>{profile.name}</strong>
                  <small>{profile.description}</small>
                </span>
                {profile.active ? <em>Live</em> : null}
              </button>
            ))}
          </div>
        </aside>

        <section className="editor-card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">Layer Editor</p>
              <h2>{selectedProfile?.name ?? "No profile loaded"}</h2>
            </div>
          </div>

          <div className="editor-topbar">
            <div className="layer-tabs">
              {selectedProfile?.layers.map((layer) => (
                <button
                  key={layer.id}
                  className={`layer-tab ${selectedLayer?.id === layer.id ? "active" : ""}`}
                  onClick={() => {
                    setSelectedLayerId(layer.id);
                    setSelectedKeyId(layer.keys[0]?.id ?? "");
                    setSelectedKnobId(layer.knobs[0]?.id ?? "");
                    setSelectedEditor("key");
                  }}
                  type="button"
                >
                  {getDisplayLayerName(layer)}
                </button>
              ))}
            </div>
          </div>

          <div className="hardware-editor">
            <div
              className="matrix-grid"
              style={{
                gridTemplateColumns: `repeat(${selectedProfile?.layout.columns ?? 4}, minmax(120px, 1fr))`
              }}
            >
              {selectedLayer?.keys
                .slice()
                .sort((left, right) => left.matrixIndex - right.matrixIndex)
                .map((binding) => (
                  <KeyTile
                    key={binding.id}
                    binding={binding}
                    label={getDisplayLabel(selectedLayer?.id, binding)}
                    selected={selectedKey?.id === binding.id}
                    onSelect={() => {
                      setSelectedKeyId(binding.id);
                      setSelectedEditor("key");
                    }}
                  />
                ))}
            </div>

            <div className="knob-column">
              {selectedLayer?.knobs.map((knob) => (
                <KnobCard
                  key={knob.id}
                  knob={knob}
                  selected={selectedEditor === "wheel" && selectedKnob?.id === knob.id}
                  onSelect={() => {
                    setSelectedKnobId(knob.id);
                    setSelectedEditor("wheel");
                  }}
                />
              ))}
            </div>
          </div>

          <div className="details-grid">
            <div className="binding-card">
              <div>
                <p className="eyebrow">Layer Settings</p>
                <h3>{getDisplayLayerName(selectedLayer) ?? "Current layer"}</h3>
                <p className="detail-copy">Settings here apply to the whole layer, not just the selected key.</p>
              </div>
              <div className="write-panel">
                <label className="write-label" htmlFor="layer-name-input">Layer name in app</label>
                <div className="binding-actions">
                  <input
                    id="layer-name-input"
                    className="write-input"
                    type="text"
                    value={layerNameDraft}
                    onChange={(event) => setLayerNameDraft(event.target.value)}
                    placeholder="Example: Windows UK Login"
                  />
                  <button className="secondary-button" onClick={saveLayerName} type="button">
                    Save Layer Name
                  </button>
                </div>
                <label className="write-label" htmlFor="layer-target-select">Target keyboard for this layer</label>
                <div className="binding-actions">
                  <select
                    id="layer-target-select"
                    className="write-input"
                    value={getLayerTarget(selectedLayer?.id)}
                    onChange={(event) =>
                      selectedLayer
                        ? setLayerTargets((current) => ({
                            ...current,
                            [selectedLayer.id]: event.target.value as TextLayoutTarget
                          }))
                        : undefined
                    }
                  >
                    {TEXT_LAYOUT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="write-help">Text mode uses this layout when turning characters like @, #, and " into HID key presses.</p>
                <label className="write-label" htmlFor="duplicate-layer-select">Duplicate this layer to</label>
                <div className="binding-actions">
                  <select
                    id="duplicate-layer-select"
                    className="write-input"
                    value={duplicateTargetLayerId}
                    onChange={(event) => setDuplicateTargetLayerId(event.target.value)}
                  >
                    <option value="">Choose target layer</option>
                    {selectedProfile?.layers
                      .filter((layer) => layer.id !== selectedLayer?.id)
                      .map((layer) => (
                        <option key={layer.id} value={layer.id}>
                          {getDisplayLayerName(layer)}
                        </option>
                      ))}
                  </select>
                  <button className="secondary-button" onClick={() => void duplicateLayerToTarget()} type="button">
                    Duplicate Layer
                  </button>
                </div>
              </div>
            </div>

            {selectedEditor === "key" ? (
              <div className="binding-card">
                <div>
                  <p className="eyebrow">Selected Key</p>
                  <h3>{getDisplayLabel(selectedLayer?.id, selectedKey) ?? "Choose a key"}</h3>
                  <p className="detail-copy">
                    {getBoardLabel(selectedKey)} at matrix position {selectedKey ? `${selectedKey.row + 1}, ${selectedKey.column + 1}` : "-"} in{" "}
                    {getDisplayLayerName(selectedLayer)}.
                  </p>
                  <p className="detail-copy strong-copy">
                    Current macro: {summarizeStrokes(selectedKey?.strokes)}
                  </p>
                </div>
                <div className="write-panel">
                  <label className="write-label" htmlFor="label-write-input">App label</label>
                  <p className="write-help">This only changes the name shown in this app. The keyboard itself stores the macro, not the label.</p>
                  <div className="binding-actions">
                    <input
                      id="label-write-input"
                      className="write-input"
                      type="text"
                      value={labelDraft}
                      onChange={(event) => setLabelDraft(event.target.value)}
                      placeholder="Short label shown on tile"
                    />
                    <button className="secondary-button" onClick={saveLabel} type="button">
                      Save App Label
                    </button>
                  </div>
                  <div className="write-mode-tabs">
                    <button
                      className={`write-mode-tab ${writeMode === "text" ? "active" : ""}`}
                      onClick={() => setWriteMode("text")}
                      type="button"
                    >
                      Text
                    </button>
                    <button
                      className={`write-mode-tab ${writeMode === "binding" ? "active" : ""}`}
                      onClick={() => setWriteMode("binding")}
                      type="button"
                    >
                      Special Keys
                    </button>
                  </div>
                  {writeMode === "text" ? (
                    <>
                      <label className="write-label" htmlFor="text-write-input">Write text to this key</label>
                      <input
                        id="text-write-input"
                        className="write-input"
                        type="text"
                        value={textDraft}
                        onChange={(event) => setTextDraft(event.target.value)}
                        placeholder="Example: test_user_01"
                      />
                      <p className="write-help">Text mode writes a literal onboard macro like <code>FROG</code> or <code>admin01</code>.</p>
                      <button className="secondary-button" onClick={() => void writeTextToSelectedKey()} type="button">
                        {isWritingText ? "Writing..." : "Write Text"}
                      </button>
                    </>
                  ) : (
                    <>
                      <label className="write-label" htmlFor="binding-write-input">Write advanced binding</label>
                      <input
                        id="binding-write-input"
                        className="write-input"
                        type="text"
                        value={bindingDraft}
                        onChange={(event) => setBindingDraft(event.target.value)}
                        placeholder="Examples: enter | f17 | ctrl+shift+t | ctrl+a, ctrl+c"
                      />
                      <p className="write-help">Click modifiers, then click a key below. You can still type directly if you want.</p>
                      <div className="binding-builder">
                        <div className="binding-group">
                          <p className="binding-group-title">Modifiers</p>
                          <div className="binding-chip-row">
                            {MODIFIER_PICKER.map((modifier) => {
                              const active = activeModifiers.includes(modifier.id);
                              return (
                                <button
                                  key={modifier.id}
                                  className={`binding-chip ${active ? "active" : ""}`}
                                  onClick={() =>
                                    setActiveModifiers((current) =>
                                      current.includes(modifier.id)
                                        ? current.filter((item) => item !== modifier.id)
                                        : [...current, modifier.id]
                                    )
                                  }
                                  type="button"
                                >
                                  {modifier.label}
                                </button>
                              );
                            })}
                            <button className="binding-chip" onClick={() => setActiveModifiers([])} type="button">
                              Clear Mods
                            </button>
                          </div>
                        </div>
                        <div className="binding-group">
                          <p className="binding-group-title">Find Key</p>
                          <input
                            className="write-input compact-input"
                            type="text"
                            value={bindingSearch}
                            onChange={(event) => setBindingSearch(event.target.value)}
                            placeholder="Search keys like page, enter, f13..."
                          />
                        </div>
                        <div className="binding-picker-grid">
                          {filteredGroups.map((group) => (
                            <div key={group.title} className="binding-group">
                              <p className="binding-group-title">{group.title}</p>
                              <div className="binding-chip-row dense">
                                {group.keys.map((key) => (
                                  <button
                                    key={key}
                                    className="binding-chip"
                                    onClick={() => appendBindingToken(key)}
                                    type="button"
                                  >
                                    {key}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="binding-actions">
                        <button className="secondary-button" onClick={() => setBindingDraft("")} type="button">
                          Clear Binding
                        </button>
                        <button
                          className="secondary-button"
                          onClick={() =>
                            setBindingDraft((current) => current.replace(/,\s*[^,]*$/, "").replace(/,\s*$/, ""))
                          }
                          type="button"
                        >
                          Remove Last Step
                        </button>
                      </div>
                      <button className="secondary-button" onClick={() => void writeBindingToSelectedKey()} type="button">
                        {isWritingText ? "Writing..." : "Write Binding"}
                      </button>
                    </>
                  )}
                </div>
                <ActionList actions={selectedKey?.actions} />
              </div>
            ) : (
              <div className="binding-card">
                <div>
                  <p className="eyebrow">Wheel Binding</p>
                  <h3>{selectedKnob?.legend ?? "Choose a wheel"}</h3>
                  <p className="detail-copy">Assign a binding to clockwise, counter-clockwise, or press.</p>
                  <p className="detail-copy strong-copy">
                    Current action: {summarizeStrokes(getSelectedWheelStrokes(selectedKnob, selectedWheelPart))}
                  </p>
                </div>
                <div className="write-panel">
                  <div className="write-mode-tabs">
                    <button
                      className={`write-mode-tab ${selectedWheelPart === "clockwise" ? "active" : ""}`}
                      onClick={() => setSelectedWheelPart("clockwise")}
                      type="button"
                    >
                      Clockwise
                    </button>
                    <button
                      className={`write-mode-tab ${selectedWheelPart === "counterClockwise" ? "active" : ""}`}
                      onClick={() => setSelectedWheelPart("counterClockwise")}
                      type="button"
                    >
                      Counter
                    </button>
                    <button
                      className={`write-mode-tab ${selectedWheelPart === "press" ? "active" : ""}`}
                      onClick={() => setSelectedWheelPart("press")}
                      type="button"
                    >
                      Press
                    </button>
                  </div>
                  <label className="write-label" htmlFor="wheel-binding-write-input">Binding for selected wheel action</label>
                  <input
                    id="wheel-binding-write-input"
                    className="write-input"
                    type="text"
                    value={bindingDraft}
                    onChange={(event) => setBindingDraft(event.target.value)}
                    placeholder="Examples: volume_up | mute | ctrl+shift+tab"
                  />
                  <p className="write-help">Use the same binding builder below, then write it to the selected wheel action.</p>
                  <div className="binding-builder">
                    <div className="binding-group">
                      <p className="binding-group-title">Modifiers</p>
                      <div className="binding-chip-row">
                        {MODIFIER_PICKER.map((modifier) => {
                          const active = activeModifiers.includes(modifier.id);
                          return (
                            <button
                              key={modifier.id}
                              className={`binding-chip ${active ? "active" : ""}`}
                              onClick={() =>
                                setActiveModifiers((current) =>
                                  current.includes(modifier.id)
                                    ? current.filter((item) => item !== modifier.id)
                                    : [...current, modifier.id]
                                )
                              }
                              type="button"
                            >
                              {modifier.label}
                            </button>
                          );
                        })}
                        <button className="binding-chip" onClick={() => setActiveModifiers([])} type="button">
                          Clear Mods
                        </button>
                      </div>
                    </div>
                    <div className="binding-group">
                      <p className="binding-group-title">Find Key</p>
                      <input
                        className="write-input compact-input"
                        type="text"
                        value={bindingSearch}
                        onChange={(event) => setBindingSearch(event.target.value)}
                        placeholder="Search keys like volume, mute, tab..."
                      />
                    </div>
                    <div className="binding-picker-grid">
                      {filteredGroups.map((group) => (
                        <div key={group.title} className="binding-group">
                          <p className="binding-group-title">{group.title}</p>
                          <div className="binding-chip-row dense">
                            {group.keys.map((key) => (
                              <button
                                key={key}
                                className="binding-chip"
                                onClick={() => appendBindingToken(key)}
                                type="button"
                              >
                                {key}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="binding-actions">
                    <button className="secondary-button" onClick={() => setBindingDraft("")} type="button">
                      Clear Binding
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() =>
                        setBindingDraft((current) => current.replace(/,\s*[^,]*$/, "").replace(/,\s*$/, ""))
                      }
                      type="button"
                    >
                      Remove Last Step
                    </button>
                  </div>
                  <button className="secondary-button" onClick={() => void writeBindingToSelectedWheel()} type="button">
                    {isWritingText ? "Writing..." : "Write Wheel Binding"}
                  </button>
                </div>
                <ActionList actions={getSelectedWheelActions(selectedKnob, selectedWheelPart)} />
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
