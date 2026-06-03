import { useAppTheme } from "@/hooks/use-app-theme";

export const FEED_COLORS = {
  page: "#FFFFFF",
  subtle: "#F4F6F8",
  divider: "#EEF1F4",
  text: "#0F1F17",
  muted: "#5A6670",
  softMuted: "#8A95A0",
  faintMuted: "#A2ACB4",
  green: "#15A05A",
  greenDark: "#0E7A43",
  greenSoft: "#E7F6EE",
  greenPanel: "#F2FAF5",
  greenBorder: "#DBEFE3",
  red: "#EF4444",
  amber: "#F59E0B",
  amberText: "#B7791F",
  darkButton: "#0F1F17",
  chipBorder: "#E6EAEE",
};

const DARK_FEED_COLORS: typeof FEED_COLORS = {
  ...FEED_COLORS,
  page: "#1c1917",
  subtle: "#292524",
  divider: "rgba(255,255,255,0.08)",
  text: "#FFFFFF",
  muted: "#D6D3D1",
  softMuted: "#A8A29E",
  faintMuted: "#78716C",
  greenSoft: "rgba(21,160,90,0.18)",
  greenPanel: "rgba(21,160,90,0.12)",
  greenBorder: "rgba(21,160,90,0.28)",
  darkButton: "#13934E",
  chipBorder: "rgba(255,255,255,0.12)",
};

export function useFeedColors() {
  const { isDark } = useAppTheme();
  return isDark ? DARK_FEED_COLORS : FEED_COLORS;
}

export const SUBJECT_STYLES: Record<string, { color: string; background: string }> = {
  Physics: { color: "#6D5DF6", background: "#EFEDFE" },
  Biology: { color: "#15A05A", background: "#E7F6EE" },
  "Computer Science": { color: "#2563EB", background: "#E8F1FE" },
  Maths: { color: "#DB2777", background: "#FDECF4" },
  Math: { color: "#DB2777", background: "#FDECF4" },
  Career: { color: "#0891B2", background: "#E3F6FB" },
  General: { color: "#64748B", background: "#EEF1F4" },
};

export function getSubjectStyle(subject?: string | null) {
  if (!subject) return SUBJECT_STYLES.General;
  return SUBJECT_STYLES[subject] ?? SUBJECT_STYLES.General;
}

export const COURSE_GRADIENTS = [
  ["#0EA371", "#0B7C8A"],
  ["#1E293B", "#0F172A"],
  ["#5B53D6", "#7C3AED"],
  ["#DB2777", "#9D174D"],
] as const;
