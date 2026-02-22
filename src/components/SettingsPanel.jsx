import { useState, useEffect } from "react";
import { settingsStore, MR7_MODELS } from "../services/nexusCore";
import { Settings, Wifi, Server, Key, Cpu, Save, AlertCircle } from "lucide-react";

export const SettingsPanel = ({ wsStatus, onConnectLocal, onConnectRemote, onDisconnect }) => {
  const [settings, setSettings] = useState(settingsStore.getAll());
  const [saved, setSaved] = useState(false);

  const update = (k, v) => setSettings(prev => ({ ...prev, [k]: v }));

  const save = () => {
    Object.entries(settings).forEach(([k, v]) => settingsStore.set(k, v));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-5 h-5 text-[#00FF41]" />
        <h2 className="font-mono text-sm text-[#00FF41] tracking-wider">SETTINGS</h2>
      </div>

      {/* WS Status */}
      <div className="bg-black/40 border border-white/10 p-4 space-y-3">
        <div className="flex items-center gap-2 mb-3">
          <Wifi className="w-4 h-4 text-[#00F0FF]" />
          <span className="font-mono text-xs text-white/70 tracking-wider">CONNECTION STATUS</span>
        </div>
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${wsStatus.local ? "bg-[#00FF41]" : "bg-[#FF3B30]"}`} />
            <span className="font-mono text-xs text-white/50">Termux: {wsStatus.local ? "CONNECTED" : "OFFLINE"}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${wsStatus.remote ? "bg-[#00FF41]" : "bg-[#FF3B30]"}`} />
            <span className="font-mono text-xs text-white/50">Remote: {wsStatus.remote ? "CONNECTED" : "OFFLINE"}</span>
          </div>
        </div>
      </div>

      {/* Termux / Local */}
      <div className="bg-black/40 border border-white/10 p-4 space-y-3">
        <div className="flex items-center gap-2 mb-3">
          <Cpu className="w-4 h-4 text-[#00FF41]" />
          <span className="font-mono text-xs text-white/70 tracking-wider">LOCAL TERMUX</span>
        </div>
        <p className="text-[10px] text-[#666666] font-mono leading-relaxed">
          Install Termux on Android. Run: <code className="text-[#00FF41]">pkg install python && pip install websockets && python nexus_agent.py</code>
        </p>
        <div className="flex gap-2">
          <input
            value={settings.termuxUrl}
            onChange={e => update("termuxUrl", e.target.value)}
            className="flex-1 bg-black border border-white/10 text-[#00FF41] font-mono text-xs px-3 py-2 focus:border-[#00FF41]/50 outline-none"
            placeholder="ws://localhost:8765"
          />
          <button
            onClick={() => onConnectLocal(settings.termuxUrl)}
            className="px-4 bg-[#00FF41]/10 border border-[#00FF41]/30 text-[#00FF41] font-mono text-xs hover:bg-[#00FF41]/20 transition-colors"
          >
            CONNECT
          </button>
        </div>
      </div>

      {/* Remote Kali */}
      <div className="bg-black/40 border border-white/10 p-4 space-y-3">
        <div className="flex items-center gap-2 mb-3">
          <Server className="w-4 h-4 text-[#00F0FF]" />
          <span className="font-mono text-xs text-white/70 tracking-wider">REMOTE KALI VPS</span>
        </div>
        <p className="text-[10px] text-[#666666] font-mono">
          On your Kali VPS run: <code className="text-[#00F0FF]">python3 nexus_agent.py --host 0.0.0.0 --port 8766</code>
        </p>
        <div className="flex gap-2">
          <input
            value={settings.remoteUrl}
            onChange={e => update("remoteUrl", e.target.value)}
            className="flex-1 bg-black border border-white/10 text-[#00F0FF] font-mono text-xs px-3 py-2 focus:border-[#00F0FF]/50 outline-none"
            placeholder="ws://YOUR_VPS_IP:8766"
          />
          <button
            onClick={() => onConnectRemote(settings.remoteUrl)}
            disabled={!settings.remoteUrl}
            className="px-4 bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-[#00F0FF] font-mono text-xs hover:bg-[#00F0FF]/20 transition-colors disabled:opacity-30"
          >
            CONNECT
          </button>
        </div>
        <button
          onClick={onDisconnect}
          className="text-[10px] font-mono text-[#FF3B30]/70 hover:text-[#FF3B30] transition-colors"
        >
          DISCONNECT ALL
        </button>
      </div>

      {/* Exec Mode */}
      <div className="bg-black/40 border border-white/10 p-4 space-y-3">
        <span className="font-mono text-xs text-white/70 tracking-wider block mb-3">EXECUTION MODE</span>
        <div className="flex gap-3">
          {["auto", "local", "remote"].map(mode => (
            <button
              key={mode}
              onClick={() => update("execMode", mode)}
              className={`px-4 py-2 font-mono text-xs border transition-colors ${
                settings.execMode === mode
                  ? "bg-[#00FF41]/20 border-[#00FF41]/60 text-[#00FF41]"
                  : "border-white/10 text-white/40 hover:border-white/30"
              }`}
            >
              {mode.toUpperCase()}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-[#666666] font-mono">
          AUTO = prefer remote, fallback local. LOCAL = Termux only. REMOTE = VPS only.
        </p>
      </div>

      {/* mr7 API Key */}
      <div className="bg-black/40 border border-white/10 p-4 space-y-3">
        <div className="flex items-center gap-2 mb-3">
          <Key className="w-4 h-4 text-[#FFB000]" />
          <span className="font-mono text-xs text-white/70 tracking-wider">MR7.AI API KEY</span>
        </div>
        <input
          type="password"
          value={settings.mr7ApiKey}
          onChange={e => update("mr7ApiKey", e.target.value)}
          className="w-full bg-black border border-white/10 text-[#FFB000] font-mono text-xs px-3 py-2 focus:border-[#FFB000]/50 outline-none"
          placeholder="mr7_..."
        />
      </div>

      {/* Default Model */}
      <div className="bg-black/40 border border-white/10 p-4 space-y-3">
        <span className="font-mono text-xs text-white/70 tracking-wider block mb-3">DEFAULT AI MODEL</span>
        <div className="space-y-2">
          {Object.values(MR7_MODELS).map(model => (
            <button
              key={model.id}
              onClick={() => update("defaultModel", model.id)}
              className={`w-full text-left px-3 py-2 border font-mono text-xs transition-colors ${
                settings.defaultModel === model.id
                  ? "border-opacity-60 bg-opacity-20"
                  : "border-white/10 text-white/40 hover:border-white/20"
              }`}
              style={settings.defaultModel === model.id ? {
                borderColor: `${model.color}60`,
                backgroundColor: `${model.color}15`,
                color: model.color,
              } : {}}
            >
              <div className="flex items-center justify-between">
                <span>{model.label}</span>
                {settings.defaultModel === model.id && <span className="text-[10px] opacity-60">DEFAULT</span>}
              </div>
              <p className="text-[10px] opacity-50 mt-0.5">{model.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={save}
        className={`w-full py-3 font-mono text-xs border transition-colors ${
          saved
            ? "bg-[#00FF41]/20 border-[#00FF41] text-[#00FF41]"
            : "bg-white/5 border-white/20 text-white/70 hover:bg-white/10"
        }`}
      >
        <div className="flex items-center justify-center gap-2">
          <Save className="w-4 h-4" />
          {saved ? "SAVED" : "SAVE SETTINGS"}
        </div>
      </button>
    </div>
  );
};
