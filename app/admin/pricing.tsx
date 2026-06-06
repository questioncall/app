import { useCallback, useState } from "react";
import { View } from "react-native";

import {
  ConfigScreenShell,
  NumberGrid,
  SectionLabel,
  useAdminConfig,
  useHydrateFromConfig,
  type PlatformConfig,
} from "@/components/admin/config-form";

/**
 * Subscription pricing editor. Each paid plan (Go / Plus / Pro / Max) exposes
 * price, base questions, bonus questions and duration; the free tier exposes
 * trial duration and question cap. All fields live on `PlatformConfig`.
 */
const PLANS = [
  { label: "Go", prefix: "planGo" },
  { label: "Plus", prefix: "planPlus" },
  { label: "Pro", prefix: "planPro" },
  { label: "Max", prefix: "planMax" },
] as const;

const PLAN_FIELDS = [
  ["Price", "Price (NPR)"],
  ["MaxQuestions", "Questions"],
  ["BonusQuestions", "Bonus"],
  ["Days", "Days"],
] as const;

const ALL_KEYS = [
  ...PLANS.flatMap((p) => PLAN_FIELDS.map(([suffix]) => `${p.prefix}${suffix}`)),
  "trialDays",
  "trialMaxQuestions",
];

export default function AdminPricingScreen() {
  const { config, loading, save } = useAdminConfig();
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  useHydrateFromConfig(
    config,
    useCallback((c: PlatformConfig) => {
      const next: Record<string, string> = {};
      for (const key of ALL_KEYS) next[key] = String(c[key] ?? "");
      setValues(next);
    }, []),
  );

  const onSave = useCallback(async () => {
    const patch: PlatformConfig = {};
    for (const key of ALL_KEYS) {
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
      title="Subscription"
      loading={loading}
      saving={saving}
      onSave={onSave}
    >
      {PLANS.map((plan) => (
        <View key={plan.prefix}>
          <SectionLabel>{plan.label} plan</SectionLabel>
          <NumberGrid
            fields={PLAN_FIELDS.map(([suffix, label]) => {
              const key = `${plan.prefix}${suffix}`;
              return { label, value: values[key] ?? "", onChangeText: setField(key) };
            })}
          />
        </View>
      ))}

      <SectionLabel>Free trial</SectionLabel>
      <NumberGrid
        fields={[
          {
            label: "Trial days",
            value: values.trialDays ?? "",
            onChangeText: setField("trialDays"),
          },
          {
            label: "Trial questions",
            value: values.trialMaxQuestions ?? "",
            onChangeText: setField("trialMaxQuestions"),
          },
        ]}
      />
    </ConfigScreenShell>
  );
}
