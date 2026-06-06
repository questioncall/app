import { useCallback, useState } from "react";

import {
  ConfigScreenShell,
  NumberGrid,
  SectionLabel,
  useAdminConfig,
  useHydrateFromConfig,
  type PlatformConfig,
} from "@/components/admin/config-form";

/**
 * Answer-format configuration — per-format time limits (minutes) and the base
 * points awarded for each answer format, plus the global max video duration.
 * All fields live on `PlatformConfig`.
 */
const FIELDS = [
  ["textFormatDuration", "Text limit (min)"],
  ["photoFormatDuration", "Photo limit (min)"],
  ["videoFormatDuration", "Video limit (min)"],
  ["maxVideoDurationMinutes", "Max video (min)"],
  ["pointsPerTextAnswer", "Text points"],
  ["pointsPerPhotoAnswer", "Photo points"],
  ["pointsPerVideoAnswer", "Video points"],
] as const;

export default function AdminFormatConfigScreen() {
  const { config, loading, save } = useAdminConfig();
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  useHydrateFromConfig(
    config,
    useCallback((c: PlatformConfig) => {
      const next: Record<string, string> = {};
      for (const [key] of FIELDS) next[key] = String(c[key] ?? "");
      setValues(next);
    }, []),
  );

  const onSave = useCallback(async () => {
    const patch: PlatformConfig = {};
    for (const [key] of FIELDS) {
      const num = Number(values[key]);
      if (Number.isFinite(num)) patch[key] = num;
    }
    setSaving(true);
    await save(patch);
    setSaving(false);
  }, [save, values]);

  const setField = (key: string) => (text: string) =>
    setValues((prev) => ({ ...prev, [key]: text }));

  return (
    <ConfigScreenShell
      title="Format Config"
      loading={loading}
      saving={saving}
      onSave={onSave}
    >
      <SectionLabel>Time limits & points</SectionLabel>
      <NumberGrid
        fields={FIELDS.map(([key, label]) => ({
          label,
          value: values[key] ?? "",
          onChangeText: setField(key),
        }))}
      />
    </ConfigScreenShell>
  );
}
