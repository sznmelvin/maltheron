interface MetricCardProps {
  title: string;
  value: string;
  change: string;
  positive?: boolean;
}

export default function MetricCard({ title, value, change, positive = true }: MetricCardProps) {
  return (
    <div className="bg-background border border-border p-5 rounded-xl">
      <h3 className="font-tiktok text-xs uppercase tracking-widest text-textSecondary mb-1">
        {title}
      </h3>
      <div className="font-mono text-3xl tracking-tight text-textPrimary">{value}</div>
      <div className={`font-geist text-xs mt-2 ${positive ? "text-success" : "text-error"}`}>
        {change}
      </div>
    </div>
  );
}