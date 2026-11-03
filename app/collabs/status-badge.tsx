const styles = {
  pending: "bg-clay/25 text-foreground",
  discussing: "bg-slate/35 text-foreground",
  confirmed: "bg-tea text-teal",
} as const;

export function StatusBadge({ status }: { status: keyof typeof styles }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${styles[status]}`}>
      {status}
    </span>
  );
}
