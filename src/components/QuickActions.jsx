import { useState } from "react";
import { Zap, Target } from "lucide-react";
import { WORKFLOWS } from "../services/nexusCore";

export const QuickActions = ({ onExecuteWorkflow, onSetTarget, currentTarget }) => {
  const [target, setTarget] = useState(currentTarget || "");

  const handleTarget = () => { if (target.trim()) onSetTarget(target.trim()); };

  return (
    <div className="flex flex-col gap-2 mb-2">
      {/* Target input */}
      <div className="flex gap-2">
        <div className="flex items-center gap-2 px-3 py-2 bg-black/40 border border-[#FF3B30]/20 flex-1">
          <Target className="w-4 h-4 text-[#FF3B30] flex-shrink-0" />
          <input
            value={target}
            onChange={e => setTarget(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleTarget()}
            placeholder="Set target (IP, domain, CIDR)..."
            className="bg-transparent font-mono text-xs text-white flex-1 outline-none placeholder:text-[#333]"
          />
          <button
            onClick={handleTarget}
            className="px-3 py-1 text-[10px] font-mono bg-[#FF3B30]/10 border border-[#FF3B30]/30 text-[#FF3B30] hover:bg-[#FF3B30]/20"
          >
            SET
          </button>
        </div>
        {currentTarget && (
          <div className="px-3 py-2 bg-[#FF3B30]/10 border border-[#FF3B30]/30 font-mono text-xs text-[#FF3B30] flex items-center gap-2">
            <span className="w-2 h-2 bg-[#FF3B30] rounded-full" />
            {currentTarget}
          </div>
        )}
      </div>

      {/* Workflow buttons */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {WORKFLOWS.map((wf) => (
          <button
            key={wf.id}
            onClick={() => onExecuteWorkflow(wf.id, currentTarget)}
            className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 bg-black/40 border border-white/10 text-white/60 font-mono text-[10px] tracking-wider hover:border-[#00FF41]/40 hover:text-[#00FF41] hover:bg-[#00FF41]/5 transition-colors"
          >
            <Zap className="w-3 h-3" />
            {wf.name.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
};
