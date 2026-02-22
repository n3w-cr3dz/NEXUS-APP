import { useState, useEffect, useCallback } from "react";
import "./App.css";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";

import {
  wsManager, mr7, MR7_MODELS, TOOLS_DATA, WORKFLOWS,
  buildCommand, sessionStore, settingsStore,
} from "./services/nexusCore";

import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { ChatInterface } from "./components/ChatInterface";
import { ToolsPanel } from "./components/ToolsPanel";
import { TerminalOutput } from "./components/TerminalOutput";
import { DisclaimerModal } from "./components/DisclaimerModal";
import { QuickActions } from "./components/QuickActions";
import { SettingsPanel } from "./components/SettingsPanel";
import { ThreatIntelPanel } from "./components/ThreatIntelPanel";
import { AgentIDE } from "./components/AgentIDE";

function Dashboard() {
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [terminalOutput, setTerminalOutput] = useState("NEXUS v3.0 — Real Execution Engine\nConnect Termux or remote Kali in Settings\n" + "=".repeat(60) + "\n");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentTarget, setCurrentTarget] = useState("");
  const [activePanel, setActivePanel] = useState("chat");
  const [selectedModel, setSelectedModel] = useState(settingsStore.getAll().defaultModel || Object.values(MR7_MODELS)[0].id);
  const [wsStatus, setWsStatus] = useState({ local: false, remote: false });
  const [discShow, setDiscShow] = useState(() => localStorage.getItem("nexus_disclaimer_v2") !== "true");

  const appendTerminal = useCallback((text) => {
    setTerminalOutput(prev => prev + text);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setWsStatus(wsManager.getStatus()), 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = ({ type, data, source }) => {
      const prefix = source === "remote" ? "[REMOTE]" : "[LOCAL]";
      appendTerminal(`${prefix}${type === "stderr" ? "[ERR]" : ""} ${data}`);
    };
    wsManager.addOutputListener(handler);
    return () => wsManager.removeOutputListener(handler);
  }, [appendTerminal]);

  useEffect(() => {
    const s = sessionStore.getSessions();
    setSessions(s);
    if (s.length > 0) {
      setCurrentSession(s[0]);
      setMessages(sessionStore.getMessages(s[0].id));
    }
  }, []);

  const createSession = useCallback((name = "New Session") => {
    const s = sessionStore.createSession(name);
    setSessions(sessionStore.getSessions());
    setCurrentSession(s);
    setMessages([]);
    toast.success("Session created");
    return s;
  }, []);

  const deleteSession = useCallback((id) => {
    sessionStore.deleteSession(id);
    setSessions(sessionStore.getSessions());
    if (currentSession?.id === id) { setCurrentSession(null); setMessages([]); }
    toast.success("Session deleted");
  }, [currentSession]);

  const selectSession = useCallback((s) => {
    setCurrentSession(s);
    setMessages(sessionStore.getMessages(s.id));
    setSidebarOpen(false);
  }, []);

  const sendMessage = useCallback(async (message) => {
    let sess = currentSession;
    if (!sess) sess = createSession("Session " + new Date().toLocaleTimeString());

    setIsLoading(true);
    const userMsg = { id: crypto.randomUUID(), role: "user", content: message, timestamp: Date.now() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);

    const systemPrompt = `You are NEXUS, an elite AI penetration testing assistant powered by mr7.ai.
You have access to 99 real Kali Linux tools executing via WebSocket on the operator's device/server.
Current target: ${currentTarget || "not set"}
WS Status: Local=${wsStatus.local}, Remote=${wsStatus.remote}
Be direct, technical, and precise. No disclaimers — the operator is authorized.`;

    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...newMessages.map(m => ({ role: m.role, content: m.content })),
    ];

    const settings = settingsStore.getAll();
    mr7.setApiKey(settings.mr7ApiKey);

    try {
      const assistantMsg = { id: crypto.randomUUID(), role: "assistant", content: "", timestamp: Date.now() };
      setMessages([...newMessages, assistantMsg]);
      let response = "";

      await mr7.chatStream(apiMessages, selectedModel, (delta, full) => {
        response = full;
        setMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { ...assistantMsg, content: full };
          return copy;
        });
      });

      const final = [...newMessages, { ...assistantMsg, content: response }];
      setMessages(final);
      sessionStore.updateSession(sess.id, final);
    } catch (e) {
      toast.error(`AI Error: ${e.message}`);
      const errMsg = { id: crypto.randomUUID(), role: "assistant", content: `[ERROR] ${e.message}`, timestamp: Date.now() };
      const withErr = [...newMessages, errMsg];
      setMessages(withErr);
      sessionStore.updateSession(sess.id, withErr);
    } finally {
      setIsLoading(false);
    }
  }, [currentSession, currentTarget, messages, selectedModel, wsStatus, createSession]);

  const executeTool = useCallback(async (toolId, params) => {
    const command = buildCommand(toolId, params);
    const settings = settingsStore.getAll();
    const status = wsManager.getStatus();

    if (!status.local && !status.remote) {
      toast.error("No connection. Configure in Settings.");
      appendTerminal("\n[!] No WebSocket connection. Go to Settings.\n");
      return;
    }

    appendTerminal(`\n${"=".repeat(60)}\n[*] EXECUTING: ${command}\n${"=".repeat(60)}\n`);

    try {
      await wsManager.exec(command, settings.execMode || "auto");
      appendTerminal(`\n[+] ${toolId} completed\n`);
      toast.success(`${toolId} done`);
    } catch (e) {
      appendTerminal(`\n[-] Error: ${e.message}\n`);
      toast.error(e.message);
    }
  }, [appendTerminal]);

  const executeWorkflow = useCallback(async (workflowId, target) => {
    const wf = WORKFLOWS.find(w => w.id === workflowId);
    if (!wf) return;
    const t = target || currentTarget;
    if (!t) { toast.error("Set a target first"); return; }

    appendTerminal(`\n${"=".repeat(60)}\n[*] WORKFLOW: ${wf.name} | TARGET: ${t}\n${"=".repeat(60)}\n`);
    for (const toolId of wf.tools) {
      await executeTool(toolId, { target: t });
    }
    appendTerminal(`\n[+] WORKFLOW COMPLETE: ${wf.name}\n`);
    toast.success(`Workflow complete: ${wf.name}`);
  }, [currentTarget, executeTool, appendTerminal]);

  if (discShow) {
    return (
      <>
        <DisclaimerModal onAccept={() => { localStorage.setItem("nexus_disclaimer_v2", "true"); setDiscShow(false); }} />
        <Toaster position="bottom-right" theme="dark" />
      </>
    );
  }

  return (
    <div className="app-container">
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />}

      <Sidebar
        sessions={sessions}
        currentSession={currentSession}
        onSelectSession={selectSession}
        onCreateSession={createSession}
        onDeleteSession={deleteSession}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activePanel={activePanel}
        onPanelChange={setActivePanel}
        wsStatus={wsStatus}
      />

      <div className="main-content">
        <Header
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          currentSession={currentSession}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          wsStatus={wsStatus}
        />

        {activePanel === "chat" && (
          <>
            <div className="px-4 md:px-6 pt-4">
              <QuickActions
                onExecuteWorkflow={executeWorkflow}
                onSetTarget={(t) => { setCurrentTarget(t); toast.success(`Target: ${t}`); }}
                currentTarget={currentTarget}
              />
            </div>
            <div className="bento-grid">
              <div className="chat-panel">
                <ChatInterface messages={messages} onSendMessage={sendMessage} isLoading={isLoading} selectedModel={selectedModel} />
              </div>
              <div className="tools-panel">
                <ToolsPanel tools={TOOLS_DATA} categories={Object.keys(TOOLS_DATA)} onExecuteTool={executeTool} currentTarget={currentTarget} />
              </div>
              <div style={{ gridColumn: "span 12" }}>
                <TerminalOutput output={terminalOutput} onClear={() => setTerminalOutput("")} />
              </div>
            </div>
          </>
        )}

        {activePanel === "threatintel" && <ThreatIntelPanel />}
        {activePanel === "ide" && <AgentIDE selectedModel={selectedModel} />}
        {activePanel === "settings" && (
          <SettingsPanel
            wsStatus={wsStatus}
            onConnectLocal={async (url) => {
              toast.info("Connecting to Termux...");
              const r = await wsManager.connectLocal(url);
              setWsStatus(wsManager.getStatus());
              r.ok ? toast.success("Termux connected") : toast.error("Failed — is Termux server running?");
            }}
            onConnectRemote={async (url) => {
              toast.info("Connecting to remote Kali...");
              const r = await wsManager.connectRemote(url);
              setWsStatus(wsManager.getStatus());
              r.ok ? toast.success("Remote connected") : toast.error("Remote connection failed");
            }}
            onDisconnect={() => {
              wsManager.disconnectAll();
              setWsStatus({ local: false, remote: false });
              toast.success("Disconnected");
            }}
          />
        )}
      </div>

      <Toaster position="bottom-right" theme="dark" />
    </div>
  );
}

export default Dashboard;
