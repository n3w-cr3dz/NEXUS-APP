import { useState, useEffect } from "react";
import { Menu, Activity, Clock, ChevronDown } from "lucide-react";
import { MR7_MODELS } from "../services/nexusCore";

export const Header = ({ onMenuClick, currentSession, selectedModel, onModelChange, wsStatus }) => {
  const [time, setTime] = useState(new Date());
  const [modelOpen, setModelOpen] = useState(false);

  useEffect(() => {
    const i = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  const model = Object.values(MR7_MODELS).find(m => m.id === selectedModel) || Object.values(MR7_MODELS)[0];

  return (
    <header className="app-header" style={{ position: "relative" }}>
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick} className="md:hidden p-2 text-[#666666] hover:text-[#00FF41] transition-colors">
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden sm:flex items-center gap-3">
          <div className="w-2 h-2 bg-[#00FF41] rounded-full status-pulse" />
          <span className="font-mono text-xs text-[#666666] tracking-wider">
            {currentSession ? `SESSION: ${currentSession.name.toUpperCase()}` : "NO ACTIVE SESSION"}
          </span>
        </div>
      </div>

      {/* Model Selector */}
      <div className="relative">
        <button
          onClick={() => setModelOpen(!modelOpen)}
          className="flex items-center gap-2 px-3 py-1.5 border font-mono text-xs transition-colors"
          style={{ borderColor: `${model.color}40`, color: model.color, backgroundColor: `${model.color}10` }}
        >
          <span>{model.label}</span>
          <ChevronDown className="w-3 h-3" />
        </button>
        {modelOpen && (
          <div className="absolute top-full right-0 mt-1 bg-[#0A0A0A] border border-white/10 z-50 min-w-[220px]">
            {Object.values(MR7_MODELS).map(m => (
              <button
                key={m.id}
                onClick={() => { onModelChange(m.id); setModelOpen(false); }}
                className="w-full text-left px-3 py-2 font-mono text-xs hover:bg-white/5 transition-colors"
                style={selectedModel === m.id ? { color: m.color } : { color: "#666666" }}
              >
                <div>{m.label}</div>
                <div className="text-[10px] opacity-50">{m.desc}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 text-[#666666]">
        <div className="hidden md:flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#00FF41]" />
          <span className="font-mono text-[10px]">
            {wsStatus?.local || wsStatus?.remote ? "CONNECTED" : "OFFLINE"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[#00FF41]">
          <Clock className="w-4 h-4" />
          <span className="font-mono text-xs tracking-wider glow-text">
            {time.toLocaleTimeString("en-US", { hour12: false })}
          </span>
        </div>
      </div>
    </header>
  );
};
