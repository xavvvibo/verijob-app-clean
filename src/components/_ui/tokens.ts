export const ui = {
  brand: { name: "Verijob" },

  // --- Legacy Tailwind class tokens (used by older _ui AppShell/Blocks) ---
  bg: "bg-slate-50",
  text: "text-slate-900",
  mutedText: "text-slate-500",
  panel: "bg-white border border-slate-200 rounded-2xl shadow-[0_10px_28px_rgba(18,38,63,0.08)]",
  borderClass: "border-slate-200",
  shadowClass: "shadow-[0_10px_28px_rgba(18,38,63,0.08)]",
  radiusClass: "rounded-2xl",

  // --- Blocks.tsx expects these ---
  card: "bg-white rounded-2xl",
  shadow: "shadow-[0_10px_28px_rgba(18,38,63,0.08)]",
  border: "border-slate-200",

  // --- Numeric radii for inline styles (used by newer AppShell we created earlier) ---
  radius: { md: 14, lg: 18 },

  // --- Color palette (optional; used by custom inline style components) ---
  colors: {
    brand: "#2F5DAA",
    ink: "#1E2F4F",
    bg: "#F7F9FC",
    surface: "#FFFFFF",
    border: "#E6ECF5",
    accent: "#F5B942",
    text: "#13233D",
    muted: "#5B6B82",
    good: "#16a34a",
    warn: "#f59e0b",
    bad: "#dc2626",
  },
};
