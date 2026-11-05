// Palette pairs; each ends on a dark color so the white initials stay readable
const gradients = [
  "from-teal to-grape",
  "from-clay to-grape",
  "from-grape to-teal",
  "from-clay to-teal",
  "from-slate to-grape",
  "from-teal to-clay",
];

export function Avatar({ id, name, size = "md" }: { id: number; name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const sizing = {
    sm: "h-10 w-10 text-sm",
    md: "h-14 w-14 text-lg",
    lg: "h-24 w-24 text-3xl",
  }[size];

  return (
    <div
      className={`${sizing} ${gradients[id % gradients.length]} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white`}
      aria-hidden
    >
      {initials}
    </div>
  );
}
