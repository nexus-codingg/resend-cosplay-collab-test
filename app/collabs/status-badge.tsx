const styles = {
  pending: "bg-amber-500/15 text-amber-600",
  discussing: "bg-sky-500/15 text-sky-600",
  confirmed: "bg-emerald-500/15 text-emerald-600",
} as const;

export function StatusBadge({ status }: { status: keyof typeof styles }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${styles[status]}`}>
      {status}
    </span>
  );
}
