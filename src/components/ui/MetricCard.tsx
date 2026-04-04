import { TrendingUp, TrendingDown } from 'lucide-react';
import { type LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  trend?: number;
  icon: LucideIcon;
  iconColor?: string;
  subtitle?: string;
}

export default function MetricCard({ title, value, trend, icon: Icon, iconColor = 'text-violet-400', subtitle }: MetricCardProps) {
  return (
    <div className="glass rounded-lg p-2.5 glass-hover">
      <div className="flex items-start justify-between">
        <div className="space-y-0.5">
          <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">{title}</p>
          <p className="text-base font-bold text-zinc-900 dark:text-white">{value}</p>
          {subtitle && <p className="text-[10px] text-zinc-500">{subtitle}</p>}
        </div>
        <div className={`w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 flex items-center justify-center ${iconColor}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      {trend !== undefined && (
        <div className="mt-2 flex items-center gap-1.5">
          {trend >= 0 ? (
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
          )}
          <span className="text-xs font-medium text-emerald-400">
            {Math.abs(trend)}% {trend >= 0 ? 'increase' : 'decrease'}
          </span>
          <span className="text-xs text-zinc-600">vs last month</span>
        </div>
      )}
    </div>
  );
}
