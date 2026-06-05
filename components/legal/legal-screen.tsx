import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { AuthNotice } from "@/components/auth/auth-notice";
import { useAppTheme } from "@/hooks/use-app-theme";
import { api } from "@/lib/api";

type LegalSectionKey = "all" | "terms" | "privacy";

type LegalPayload = {
  termsOfUseContent: string;
  privacyPolicyContent: string;
  updatedAt?: string | Date | null;
};

type LegalClause = {
  number: string | null;
  heading: string | null;
  body: string;
};

type LegalSection = {
  key: "terms" | "privacy";
  title: string;
  blurb: string;
  icon: keyof typeof Ionicons.glyphMap;
  clauses: LegalClause[];
};

const SECTION_META: Record<
  "terms" | "privacy",
  { title: string; blurb: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  terms: {
    title: "Terms of Use",
    blurb: "The rules that govern how you use QuestionCall fairly and safely.",
    icon: "document-text-outline",
  },
  privacy: {
    title: "Privacy Policy",
    blurb: "What information we collect and how we keep it protected.",
    icon: "shield-checkmark-outline",
  },
};

function splitParagraphs(content: string) {
  return content
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

// Each clause is stored as "1. Heading\nBody text". Pull the leading number and
// heading out so they can be rendered distinctly from the body copy.
function parseClause(paragraph: string): LegalClause {
  const newlineIndex = paragraph.indexOf("\n");
  const firstLine =
    newlineIndex === -1 ? paragraph.trim() : paragraph.slice(0, newlineIndex).trim();
  const rest = newlineIndex === -1 ? "" : paragraph.slice(newlineIndex + 1).trim();

  const match = firstLine.match(/^(\d+)\.\s*(.+)$/);
  if (match) {
    return { number: match[1], heading: match[2], body: rest };
  }

  return { number: null, heading: null, body: paragraph };
}

function formatUpdatedAt(updatedAt?: string | Date | null) {
  if (!updatedAt) {
    return "Live platform document";
  }

  const date = updatedAt instanceof Date ? updatedAt : new Date(updatedAt);

  if (Number.isNaN(date.getTime())) {
    return "Live platform document";
  }

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getScreenTitle(section: LegalSectionKey) {
  if (section === "terms") {
    return "Terms of Use";
  }

  if (section === "privacy") {
    return "Privacy Policy";
  }

  return "Legal";
}

function getScreenSubtitle(section: LegalSectionKey) {
  if (section === "terms") {
    return "Please review the rules that govern your use of QuestionCall.";
  }

  if (section === "privacy") {
    return "Learn what data we collect and how we keep it safe.";
  }

  return "Read the platform rules and data policy before you continue.";
}

export function LegalScreen({ section = "all" }: { section?: LegalSectionKey }) {
  const [content, setContent] = useState<LegalPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { statusBarStyle, backgroundColor, iconColor, primaryColor, primarySoftColor } =
    useAppTheme();

  useEffect(() => {
    let mounted = true;

    async function loadLegalContent() {
      setIsLoading(true);
      setError(null);

      try {
        const res = await api.get("/legal");
        if (mounted) {
          setContent(res.data);
        }
      } catch (err: any) {
        if (mounted) {
          setError(
            err?.response?.data?.error ??
              err?.response?.data?.message ??
              "Failed to load legal content.",
          );
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadLegalContent();

    return () => {
      mounted = false;
    };
  }, []);

  const sections = useMemo<LegalSection[]>(() => {
    if (!content) {
      return [];
    }

    const allSections: LegalSection[] = [
      {
        key: "terms",
        ...SECTION_META.terms,
        clauses: splitParagraphs(content.termsOfUseContent).map(parseClause),
      },
      {
        key: "privacy",
        ...SECTION_META.privacy,
        clauses: splitParagraphs(content.privacyPolicyContent).map(parseClause),
      },
    ];

    if (section === "all") {
      return allSections;
    }

    return allSections.filter((item) => item.key === section);
  }, [content, section]);

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      <View className="px-6 pb-4 pt-16">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="h-11 w-11 items-center justify-center rounded-full border border-border bg-card"
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-back" size={20} color={iconColor} />
          </TouchableOpacity>

          <View className="h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card">
            <Image
              source={require("../../assets/images/logo.png")}
              style={{ width: 28, height: 28 }}
              resizeMode="contain"
            />
          </View>

          <View className="flex-1">
            <Text className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              QuestionCall
            </Text>
            <Text className="text-[22px] font-bold tracking-tight text-foreground">
              {getScreenTitle(section)}
            </Text>
          </View>
        </View>

        <Text className="mt-4 text-[15px] leading-6 text-muted-foreground">
          {getScreenSubtitle(section)}
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={iconColor} />
        </View>
      ) : error ? (
        <View className="px-6 pt-2">
          <AuthNotice tone="error" message={error} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-row items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3">
            <Ionicons name="time-outline" size={16} color={iconColor} />
            <Text className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Last updated
            </Text>
            <Text className="ml-auto text-sm font-semibold text-foreground">
              {formatUpdatedAt(content?.updatedAt)}
            </Text>
          </View>

          {sections.map((item) => (
            <View
              key={item.key}
              className="mt-4 overflow-hidden rounded-3xl border border-border bg-card"
            >
              <View className="flex-row items-center gap-3 border-b border-border px-5 py-4">
                <View
                  className="h-11 w-11 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: primarySoftColor }}
                >
                  <Ionicons name={item.icon} size={22} color={primaryColor} />
                </View>
                <View className="flex-1">
                  <Text className="text-[18px] font-bold tracking-tight text-foreground">
                    {item.title}
                  </Text>
                  <Text className="mt-0.5 text-[12px] leading-4 text-muted-foreground">
                    {item.blurb}
                  </Text>
                </View>
              </View>

              <View className="gap-5 px-5 py-5">
                {item.clauses.map((clause, index) => (
                  <View key={`${item.key}-${index}`}>
                    {clause.heading ? (
                      <View className="mb-2 flex-row items-center gap-2.5">
                        {clause.number ? (
                          <View
                            className="h-6 w-6 items-center justify-center rounded-full"
                            style={{ backgroundColor: primarySoftColor }}
                          >
                            <Text
                              className="text-[12px] font-bold"
                              style={{ color: primaryColor }}
                            >
                              {clause.number}
                            </Text>
                          </View>
                        ) : null}
                        <Text className="flex-1 text-[15px] font-semibold text-foreground">
                          {clause.heading}
                        </Text>
                      </View>
                    ) : null}
                    {clause.body ? (
                      <Text className="text-[14px] leading-7 text-muted-foreground">
                        {clause.body}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          ))}

          {section === "all" ? (
            <Text className="mt-6 px-2 text-center text-[12px] leading-5 text-muted-foreground">
              You can revisit these documents any time from Menu › Legal.
            </Text>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
