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

type LegalSection = {
  key: "terms" | "privacy";
  title: string;
  body: string[];
};

function splitParagraphs(content: string) {
  return content
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
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

export function LegalScreen({ section = "all" }: { section?: LegalSectionKey }) {
  const [content, setContent] = useState<LegalPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { statusBarStyle, backgroundColor, iconColor } = useAppTheme();

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
        title: "Terms of Use",
        body: splitParagraphs(content.termsOfUseContent),
      },
      {
        key: "privacy",
        title: "Privacy Policy",
        body: splitParagraphs(content.privacyPolicyContent),
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
          Read the platform rules and data policy before you continue.
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
          <View className="rounded-3xl border border-border bg-card px-5 py-4">
            <Text className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Last updated
            </Text>
            <Text className="mt-1 text-sm font-medium text-foreground">
              {formatUpdatedAt(content?.updatedAt)}
            </Text>
          </View>

          {sections.map((item) => (
            <View
              key={item.key}
              className="mt-4 rounded-3xl border border-border bg-card px-5 py-5"
            >
              <Text className="text-[22px] font-bold tracking-tight text-foreground">
                {item.title}
              </Text>
              <View className="mt-4 gap-4">
                {item.body.map((paragraph, index) => (
                  <Text
                    key={`${item.key}-${index}`}
                    className="text-[14px] leading-7 text-muted-foreground"
                  >
                    {paragraph}
                  </Text>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
