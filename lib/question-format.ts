// Mirrors web/lib/question-types.ts — keep these helpers in sync with the web
// so the answer-format wire shape stays identical between platforms.

export type BaseAnswerFormat = "TEXT" | "PHOTO" | "VIDEO";
export type SelectableAnswerFormat = BaseAnswerFormat | "ANY";
export type AnswerFormat =
  | "TEXT"
  | "PHOTO"
  | "VIDEO"
  | "ANY"
  | "TEXT_PHOTO"
  | "TEXT_VIDEO"
  | "PHOTO_VIDEO"
  | "TEXT_PHOTO_VIDEO";

export const BASE_ANSWER_FORMATS: readonly BaseAnswerFormat[] = [
  "TEXT",
  "PHOTO",
  "VIDEO",
];

export function buildAnswerFormatFromSelection(
  selectedFormats: readonly string[],
): AnswerFormat {
  const selected = new Set<BaseAnswerFormat>();

  for (const format of selectedFormats) {
    if ((BASE_ANSWER_FORMATS as readonly string[]).includes(format)) {
      selected.add(format as BaseAnswerFormat);
    }
  }

  const normalized = BASE_ANSWER_FORMATS.filter((format) => selected.has(format));

  if (normalized.length === 0) return "ANY";
  if (normalized.length === 1) return normalized[0];
  return normalized.join("_") as AnswerFormat;
}

export function toggleSelectableAnswerFormat(
  selectedFormats: readonly SelectableAnswerFormat[],
  nextFormat: SelectableAnswerFormat,
): SelectableAnswerFormat[] {
  if (nextFormat === "ANY") return ["ANY"];

  const current = new Set<BaseAnswerFormat>(
    selectedFormats.filter((format): format is BaseAnswerFormat => format !== "ANY"),
  );

  if (current.has(nextFormat)) current.delete(nextFormat);
  else current.add(nextFormat);

  const normalized = BASE_ANSWER_FORMATS.filter((format) => current.has(format));
  return normalized.length === 0 ? ["ANY"] : normalized;
}
