import { useCallback, useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useAppTheme } from "@/hooks/use-app-theme";
import {
  ConfigScreenShell,
  NumberGrid,
  SectionLabel,
  SwitchRow,
  useAdminConfig,
  useHydrateFromConfig,
  type PlatformConfig,
} from "@/components/admin/config-form";

/**
 * General platform settings — the bulk of the numeric knobs on
 * `PlatformConfig`, grouped the way the web settings page presents them.
 * Anti-cheat lives on the Security tab; format limits live on Format Config.
 */
const GROUPS: { title: string; fields: [string, string][] }[] = [
  {
    title: "Landing",
    fields: [["landingUserCountOffset", "User count offset"]],
  },
  {
    title: "Teacher & ratings",
    fields: [
      ["commissionPercent", "Commission %"],
      ["qualificationThreshold", "Qualify score"],
      ["scoreDeductionAmount", "Timeout penalty"],
      ["maxQuestionResetCount", "Q reset/day"],
      ["ratingPointsFor2Star", "2★ points"],
      ["ratingPointsFor3Star", "3★ points"],
      ["ratingPointsFor4Star", "4★ points"],
      ["ratingPointsFor5Star", "5★ points"],
      ["bonusPointsFor4Star", "4★ bonus"],
      ["bonusPointsFor5Star", "5★ bonus"],
      ["penaltyPointsForLowRating", "Low-rating penalty"],
      ["monthlyHighScoreBonusPoints", "Monthly bonus"],
    ],
  },
  {
    title: "Withdrawal",
    fields: [
      ["pointToNprRate", "Point→NPR"],
      ["minWithdrawalPoints", "Min withdraw"],
    ],
  },
  {
    title: "Referral",
    fields: [
      ["referralBonusQuestions", "Referee bonus Q"],
      ["referrerBonusQuestions", "Referrer bonus Q"],
      ["bonusQuestionValueNpr", "Bonus Q value"],
    ],
  },
  {
    title: "Peer comments",
    fields: [
      ["peerCommentPointThreshold", "Point threshold"],
      ["peerCommentMinPointReward", "Min reward"],
      ["peerCommentMaxPointReward", "Max reward"],
    ],
  },
  {
    title: "Quiz",
    fields: [
      ["quizQuestionCount", "Questions"],
      ["quizTimeLimitSeconds", "Time (sec)"],
      ["quizRepeatResetDays", "Repeat reset (d)"],
      ["quizViolationWarningLimit", "Violation limit"],
      ["freeQuizDailySessionLimit", "Free/day"],
      ["freeQuizPassPercent", "Free pass %"],
      ["freeQuizPointReward", "Free reward"],
      ["premiumQuizDailySessionLimit", "Premium/day"],
      ["premiumQuizPassPercent", "Premium pass %"],
      ["premiumQuizPointReward", "Premium reward"],
    ],
  },
  {
    title: "Course",
    fields: [
      ["coursePurchaseCommissionPercent", "Purchase commission %"],
      ["courseProgressCompletionThreshold", "Completion %"],
      ["liveSessionNotificationLeadMinutes", "Live lead (min)"],
    ],
  },
];

const NUMERIC_KEYS = GROUPS.flatMap((g) => g.fields.map(([key]) => key));

type DailyTarget = { target: string; bonus: string };

export default function AdminSettingsScreen() {
  const { primaryColor } = useAppTheme();
  const { config, loading, save } = useAdminConfig();
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [referralEnabled, setReferralEnabled] = useState(true);
  const [targets, setTargets] = useState<DailyTarget[]>([]);

  useHydrateFromConfig(
    config,
    useCallback((c: PlatformConfig) => {
      const next: Record<string, string> = {};
      for (const key of NUMERIC_KEYS) next[key] = String(c[key] ?? "");
      setValues(next);
      setReferralEnabled(c.referralEnabled !== false);
      setTargets(
        Array.isArray(c.dailyTargets)
          ? c.dailyTargets.map((t: { target: number; bonus: number }) => ({
              target: String(t.target ?? ""),
              bonus: String(t.bonus ?? ""),
            }))
          : [],
      );
    }, []),
  );

  const setField = (key: string) => (text: string) =>
    setValues((prev) => ({ ...prev, [key]: text }));

  const setTargetField = (index: number, field: keyof DailyTarget) => (text: string) =>
    setTargets((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: text } : t)));

  const onSave = useCallback(async () => {
    const patch: PlatformConfig = { referralEnabled };
    for (const key of NUMERIC_KEYS) {
      const num = Number(values[key]);
      if (Number.isFinite(num)) patch[key] = num;
    }
    patch.dailyTargets = targets
      .map((t) => ({ target: Number(t.target), bonus: Number(t.bonus) }))
      .filter((t) => Number.isFinite(t.target) && Number.isFinite(t.bonus));
    setSaving(true);
    await save(patch);
    setSaving(false);
  }, [save, values, referralEnabled, targets]);

  return (
    <ConfigScreenShell title="Settings" loading={loading} saving={saving} onSave={onSave}>
      {GROUPS.map((group) => (
        <View key={group.title}>
          <SectionLabel>{group.title}</SectionLabel>
          <NumberGrid
            fields={group.fields.map(([key, label]) => ({
              label,
              value: values[key] ?? "",
              onChangeText: setField(key),
            }))}
          />
        </View>
      ))}

      <SwitchRow
        label="Referral program enabled"
        value={referralEnabled}
        onValueChange={setReferralEnabled}
      />

      <SectionLabel>Daily targets</SectionLabel>
      {targets.map((t, index) => (
        <View key={index} className="mb-2 flex-row items-center gap-2">
          <TextInput
            value={t.target}
            onChangeText={setTargetField(index, "target")}
            keyboardType="numeric"
            placeholder="Target"
            placeholderTextColor="#6B7280"
            className="flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
          />
          <TextInput
            value={t.bonus}
            onChangeText={setTargetField(index, "bonus")}
            keyboardType="numeric"
            placeholder="Bonus"
            placeholderTextColor="#6B7280"
            className="flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
          />
          <TouchableOpacity
            onPress={() => setTargets((prev) => prev.filter((_, i) => i !== index))}
            className="h-10 w-10 items-center justify-center rounded-full border border-border"
            activeOpacity={0.85}
          >
            <Ionicons name="remove" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity
        onPress={() => setTargets((prev) => [...prev, { target: "", bonus: "" }])}
        activeOpacity={0.85}
        className="mt-1 flex-row items-center gap-1.5 self-start rounded-full border border-border px-3 py-1.5"
      >
        <Ionicons name="add" size={16} color={primaryColor} />
        <Text className="text-[12px] font-semibold" style={{ color: primaryColor }}>
          Add target
        </Text>
      </TouchableOpacity>
    </ConfigScreenShell>
  );
}
