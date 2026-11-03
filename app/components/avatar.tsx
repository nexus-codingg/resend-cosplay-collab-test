const gradients = [
  "from-fuchsia-500 to-violet-600",
  "from-sky-500 to-indigo-600",
  "from-rose-500 to-orange-500",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-pink-600",
  "from-violet-500 to-cyan-500",
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
