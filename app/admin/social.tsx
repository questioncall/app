import { useCallback, useState } from "react";

import {
  ConfigScreenShell,
  Field,
  SectionLabel,
  useAdminConfig,
  useHydrateFromConfig,
  type PlatformConfig,
} from "@/components/admin/config-form";

type SocialLink = { platform: string; url: string };

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Social media link editor. The config document stores a normalized
 * `socialLinks: { platform, url }[]`; we render one URL field per platform and
 * PUT the whole array back (the backend re-normalizes and mirrors legacy
 * `social<Platform>Handle` fields).
 */
export default function AdminSocialScreen() {
  const { config, loading, save } = useAdminConfig();
  const [saving, setSaving] = useState(false);
  const [links, setLinks] = useState<SocialLink[]>([]);

  useHydrateFromConfig(
    config,
    useCallback((c: PlatformConfig) => {
      setLinks(
        Array.isArray(c.socialLinks)
          ? c.socialLinks.map((l: SocialLink) => ({
              platform: l.platform,
              url: l.url ?? "",
            }))
          : [],
      );
    }, []),
  );

  const setUrl = (platform: string) => (url: string) =>
    setLinks((prev) => prev.map((l) => (l.platform === platform ? { ...l, url } : l)));

  const onSave = useCallback(async () => {
    setSaving(true);
    await save({
      socialLinks: links.map((l) => ({ platform: l.platform, url: l.url.trim() })),
    });
    setSaving(false);
  }, [save, links]);

  return (
    <ConfigScreenShell
      title="Social Media"
      loading={loading}
      saving={saving}
      onSave={onSave}
    >
      <SectionLabel>Profile links</SectionLabel>
      {links.map((link) => (
        <Field
          key={link.platform}
          label={titleCase(link.platform)}
          value={link.url}
          onChangeText={setUrl(link.platform)}
          placeholder={`https://…`}
          autoCapitalize="none"
        />
      ))}
    </ConfigScreenShell>
  );
}
