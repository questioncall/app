import { useCallback, useState } from "react";

import {
  ConfigScreenShell,
  Field,
  useAdminConfig,
  useHydrateFromConfig,
  type PlatformConfig,
} from "@/components/admin/config-form";

/**
 * Legal content editor — Terms of Use + Privacy Policy. These are publicly
 * shown but admin-editable fields on `PlatformConfig`
 * (`termsOfUseContent` / `privacyPolicyContent`).
 */
export default function AdminLegalScreen() {
  const { config, loading, save } = useAdminConfig();
  const [saving, setSaving] = useState(false);
  const [terms, setTerms] = useState("");
  const [privacy, setPrivacy] = useState("");

  useHydrateFromConfig(
    config,
    useCallback((c: PlatformConfig) => {
      setTerms(c.termsOfUseContent || "");
      setPrivacy(c.privacyPolicyContent || "");
    }, []),
  );

  const onSave = useCallback(async () => {
    setSaving(true);
    await save({
      termsOfUseContent: terms.trim(),
      privacyPolicyContent: privacy.trim(),
    });
    setSaving(false);
  }, [save, terms, privacy]);

  return (
    <ConfigScreenShell title="Legal" loading={loading} saving={saving} onSave={onSave}>
      <Field
        label="Terms of Use"
        value={terms}
        onChangeText={setTerms}
        placeholder="Terms of use content…"
        multiline
      />
      <Field
        label="Privacy Policy"
        value={privacy}
        onChangeText={setPrivacy}
        placeholder="Privacy policy content…"
        multiline
      />
    </ConfigScreenShell>
  );
}
