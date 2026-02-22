import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Terminal, Plus, Trash2, MessageSquare, Shield, X,
  Settings, Brain, Search, Code2, Wifi, WifiOff
} from "lucide-react";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";

const NAV = [
  { id: "chat",       icon: Terminal,  label: "TERMINAL",     color: "#00FF41" },
  { id: "threatintel",icon: Search,    label: "THREAT INTEL", color: "#00F0FF" },
  { id: "ide",        icon: Code2,     label: "AGENT IDE",    color: "#FFB000" },
  { id: "settings",   icon: Settings,  label: "SETTINGS",     color: "#9B59B6" },
];

export const Sidebar = ({
  sessions, currentSession, onSelectSession, onCreateSession,
  onDeleteSession, isOpen, onClose, activePanel, onPanelChange, wsStatus
}) => {
  const [hoveredSession, setHoveredSession] = useState(null);

  return (
    <aside className={`sidebar ${isOpen ? "open" : ""}`}>
      {/* Logo */}
      <div className="p-4 border-b border-[rgba(0,255,65,0.2)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center bg-[#00FF41]/10 border border-[#00FF41]/30">
              <Shield className="w-5 h-5 text-[#00FF41]" />
            </div>
            <div>
              <h1 className="font-mono text-sm font-bold tracking-wider text-[#00FF41] glow-text">NEXUS</h1>
              <p className="text-[10px] text-[#666666] tracking-widest uppercase">mr7.ai Powered</p>
            </div>
          </div>
          <button className="md:hidden p-2 text-[#666666] hover:text-white" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* WS Status */}
      <div className="px-4 py-2 border-b border-white/5">
        <div className="flex gap-3 text-[10px] font-mono">
          <div className="flex items-center gap-1.5">
            {wsStatus?.local ? <Wifi className="w-3 h-3 text-[#00FF41]" /> : <WifiOff className="w-3 h-3 text-[#FF3B30]" />}
            <span className={wsStatus?.local ? "text-[#00FF41]" : "text-[#666666]"}>Termux</span>
          </div>
          <div className="flex items-center gap-1.5">
            {wsStatus?.remote ? <Wifi className="w-3 h-3 text-[#00F0FF]" /> : <WifiOff className="w-3 h-3 text-[#666666]" />}
            <span className={wsStatus?.remote ? "text-[#00F0FF]" : "text-[#666666]"}>Remote</span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="p-2 border-b border-white/5">
        {NAV.map(({ id, icon: Icon, label, color }) => (
          <button
            key={id}
            onClick={() => { onPanelChange(id); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-2 mb-1 font-mono text-xs tracking-wider transition-colors"
            style={activePanel === id
              ? { backgroundColor: `${color}15`, color, borderLeft: `2px solid ${color}` }
              : { color: "#666666" }
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </button>
        ))}
      </div>

      {/* New Session */}
      <div className="p-3">
        <Button
          onClick={() => onCreateSession("New Session")}
          className="w-full bg-transparent border border-[#00FF41]/30 text-[#00FF41] hover:bg-[#00FF41]/10 font-mono text-xs tracking-wider"
        >
          <Plus className="w-4 h-4 mr-2" />
          NEW SESSION
        </Button>
      </div>

      {/* Sessions */}
      <div className="px-4 py-1">
        <span className="font-mono text-[10px] text-[#666666] tracking-widest uppercase">Sessions</span>
      </div>
      <ScrollArea className="flex-1">
        <div className="session-list">
          <AnimatePresence>
            {sessions.map((session) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={`session-item ${currentSession?.id === session.id ? "active" : ""}`}
                onClick={() => { onSelectSession(session); onPanelChange("chat"); }}
                onMouseEnter={() => setHoveredSession(session.id)}
                onMouseLeave={() => setHoveredSession(null)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <MessageSquare className="w-4 h-4 text-[#666666] flex-shrink-0" />
                    <span className="font-mono text-xs text-white/80 truncate">{session.name}</span>
                  </div>
                  {hoveredSession === session.id && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                      className="p-1 text-[#FF3B30] hover:bg-[#FF3B30]/10"
                    >
                      <Trash2 className="w-3 h-3" />
                    </motion.button>
                  )}
                </div>
                {session.messages?.length > 0 && (
                  <span className="text-[10px] text-[#666666] ml-6">{session.messages.length} messages</span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-[rgba(0,255,65,0.2)]">
        <div className="flex items-center gap-2 text-[#666666]">
          <Brain className="w-4 h-4" />
          <span className="font-mono text-[10px] tracking-wider">mr7.ai ACTIVE</span>
          <span className="w-2 h-2 bg-[#00FF41] rounded-full status-pulse ml-auto" />
        </div>
      </div>
    </aside>
  );
};
