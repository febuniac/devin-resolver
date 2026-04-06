import { ArrowRight } from 'lucide-react';

interface PipelineStep {
  label: string;
  title: string;
  subtitle: string;
  type: 'trigger' | 'autonomous' | 'checkpoint' | 'output' | 'analytics';
  active?: boolean;
}

const typeStyles: Record<string, { border: string; badge: string; dot: string }> = {
  trigger: { border: 'border-emerald-500/40', badge: 'bg-emerald-500/15 text-emerald-400', dot: 'bg-emerald-400' },
  autonomous: { border: 'border-devin-purple/40', badge: 'bg-devin-purple/15 text-devin-blue', dot: 'bg-devin-purple' },
  checkpoint: { border: 'border-amber-500/40 border-dashed', badge: 'bg-amber-500/15 text-amber-400', dot: 'bg-amber-400' },
  output: { border: 'border-emerald-500/40', badge: 'bg-emerald-500/15 text-emerald-400', dot: 'bg-emerald-400' },
  analytics: { border: 'border-devin-purple/40', badge: 'bg-devin-purple/15 text-devin-blue', dot: 'bg-devin-purple' },
};

const steps: PipelineStep[] = [
  { label: 'TRIGGER', title: 'GitHub Issues', subtitle: '312 open via MCP', type: 'trigger' },
  { label: 'STEP 1', title: 'AI Triage', subtitle: 'Filter, sort, assign', type: 'autonomous' },
  { label: 'STEP 2', title: 'Your Approval', subtitle: 'Pick batch in 30s', type: 'checkpoint' },
  { label: 'STEP 3', title: 'Devin Writes + Tests', subtitle: 'Desktop test recording', type: 'autonomous', active: true },
  { label: 'STEP 4', title: 'PR + Slack Notify', subtitle: 'Ready for review', type: 'output' },
  { label: 'STEP 5', title: 'Monthly Report', subtitle: 'PRs approved this month', type: 'analytics' },
];

export default function WorkflowPipeline() {
  return (
    <div className="glass rounded-xl p-4">
      <h3 className="text-xs font-semibold text-zinc-300 mb-3 uppercase tracking-wider">Automation Pipeline</h3>
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {steps.map((step, i) => {
          const style = typeStyles[step.type];
          return (
            <div key={i} className="flex items-center gap-2 flex-shrink-0">
              <div className={`relative rounded-lg border-2 ${style.border} p-2.5 min-w-32 ${step.active ? 'animate-pulse-glow' : ''} bg-zinc-900/80 pipeline-card`}>
                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold mb-1 ${style.badge}`}>
                  {step.label}
                </span>
                <p className="text-xs font-semibold text-white pipeline-title">{step.title}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{step.subtitle}</p>
                {step.active && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-devin-purple animate-pulse" />
                )}
              </div>
              {i < steps.length - 1 && (
                <ArrowRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-2.5 text-[10px]">
        {[
          { label: 'Trigger', color: 'bg-emerald-400' },
          { label: 'Devin Autonomous', color: 'bg-devin-purple' },
          { label: 'Human Checkpoint', color: 'bg-amber-400' },
          { label: 'Output', color: 'bg-emerald-400' },
          { label: 'Analytics', color: 'bg-devin-purple' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className={`w-3 h-0.5 rounded ${item.color}`} />
            <span className="text-zinc-500">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
