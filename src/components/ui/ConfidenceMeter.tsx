interface ConfidenceMeterProps {
  value: number;
  size?: 'sm' | 'md';
}

export default function ConfidenceMeter({ value, size = 'sm' }: ConfidenceMeterProps) {
  const color = value >= 90 ? 'bg-emerald-400' : value >= 75 ? 'bg-amber-400' : 'bg-red-400';
  const textColor = value >= 90 ? 'text-emerald-400' : value >= 75 ? 'text-amber-400' : 'text-red-400';
  const width = size === 'sm' ? 'w-16' : 'w-24';
  const height = size === 'sm' ? 'h-1.5' : 'h-2';

  return (
    <div className="flex items-center gap-2">
      <div className={`${width} ${height} rounded-full bg-zinc-800 overflow-hidden`}>
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className={`text-xs font-medium ${textColor}`}>{value}%</span>
    </div>
  );
}
