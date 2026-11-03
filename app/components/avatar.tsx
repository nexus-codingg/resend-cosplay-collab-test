// Palette pairs; each ends on a dark color so the white initials stay readable
const gradients = [
  "from-teal to-grape",
  "from-clay to-grape",
  "from-grape to-teal",
  "from-clay to-teal",
  "from-slate to-grape",
  "from-teal to-clay",
];

export function Avatar({ id, name, size = "md" }: { id: number; name: string; size?: "md" | "lg" }) {
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const sizing = size === "lg" ? "h-24 w-24 text-3xl" : "h-14 w-14 text-lg";

  return (
    <div
      className={`${sizing} ${gradients[id % gradients.length]} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white`}
      aria-hidden
    >
      {initials}
    </div>
  );
}
