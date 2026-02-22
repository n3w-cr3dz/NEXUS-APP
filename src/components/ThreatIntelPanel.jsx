import { useState } from "react";
import { mr7, settingsStore } from "../services/nexusCore";
import { Search, Shield, AlertTriangle, Database, Eye, Loader2 } from "lucide-react";

const TABS = ["THREAT INTEL", "IOC LOOKUP", "CRED EXPOSURE", "EXPLOIT SEARCH"];

export const ThreatIntelPanel = () => {
  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setResults(null);

    const settings = settingsStore.getAll();
    mr7.setApiKey(settings.mr7ApiKey);

    try {
      let data;
      switch (tab) {
        case 0: data = await mr7.threatIntelSearch(query); break;
        case 1: data = await mr7.iocLookup(query); break;
        case 2: data = await mr7.credentialCheck(query); break;
        case 3: data = await mr7.exploitSearch(query); break;
        default: break;
      }
      setResults(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const tabColors = ["#00FF41", "#00F0FF", "#FF3B30", "#FFB000"];
  const tabIcons = [Shield, Eye, Database, AlertTriangle];

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <div className="flex items-center gap-3 mb-4">
        <Shield className="w-5 h-5 text-[#00FF41]" />
        <h2 className="font-mono text-sm text-[#00FF41] tracking-wider">THREAT INTELLIGENCE</h2>
        <span className="text-[10px] font-mono text-[#666666] ml-auto">Powered by mr7.ai</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10">
        {TABS.map((t, i) => {
          const Icon = tabIcons[i];
          return (
            <button
              key={t}
              onClick={() => { setTab(i); setResults(null); setError(""); }}
              className="px-4 py-2 font-mono text-[10px] tracking-wider transition-colors flex items-center gap-2"
              style={tab === i ? { color: tabColors[i], borderBottom: `2px solid ${tabColors[i]}` } : { color: "#666666" }}
            >
              <Icon className="w-3 h-3" />
              {t}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && search()}
          placeholder={[
            "Search threat actors, malware, campaigns...",
            "IP, domain, hash, URL...",
            "Email or domain to check...",
            "CVE, software, version...",
          ][tab]}
          className="flex-1 bg-black/60 border border-white/10 text-white font-mono text-xs px-4 py-3 outline-none focus:border-white/30"
          style={{ borderColor: `${tabColors[tab]}30` }}
        />
        <button
          onClick={search}
          disabled={loading || !query.trim()}
          className="px-6 border font-mono text-xs flex items-center gap-2 transition-colors disabled:opacity-30"
          style={{ backgroundColor: `${tabColors[tab]}15`, borderColor: `${tabColors[tab]}50`, color: tabColors[tab] }}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          SEARCH
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-[#FF3B30]/10 border border-[#FF3B30]/30 p-4 font-mono text-xs text-[#FF3B30]">
          <AlertTriangle className="w-4 h-4 inline mr-2" />
          {error}
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="bg-black/60 border border-white/10 p-4 font-mono text-xs text-white/80 overflow-auto max-h-[60vh]">
          <pre className="whitespace-pre-wrap text-[11px] leading-relaxed">
            {JSON.stringify(results, null, 2)}
          </pre>
        </div>
      )}

      {!results && !loading && !error && (
        <div className="text-center py-16 text-[#666666] font-mono text-xs">
          <Shield className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p>Enter a query to search mr7.ai threat intelligence</p>
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            {[["APT28", 0], ["192.168.1.1", 1], ["admin@target.com", 2], ["log4shell", 3]].map(([s, i]) => (
              <button
                key={s}
                onClick={() => { setTab(i); setQuery(s); }}
                className="px-3 py-1 text-[10px] border border-white/10 text-white/40 hover:border-white/30 hover:text-white/70 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
