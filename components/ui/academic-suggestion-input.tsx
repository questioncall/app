import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

import { useAppTheme } from "@/hooks/use-app-theme";

type AcademicSuggestionInputProps = {
  value: string;
  onChangeText: (value: string) => void;
  options: readonly string[];
  placeholder: string;
  inputBackgroundColor?: string;
};

export function AcademicSuggestionInput({
  value,
  onChangeText,
  options,
  placeholder,
  inputBackgroundColor,
}: AcademicSuggestionInputProps) {
  const { primaryColor, cardColor, borderColor, mutedIconColor, isDark } = useAppTheme();
  const textColor = isDark ? "#f1f5f9" : "#0f172a";

  return (
    <View style={{ gap: 10 }}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={mutedIconColor}
        autoCapitalize="words"
        style={{
          borderWidth: 1,
          borderColor,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 11,
          color: textColor,
          backgroundColor: inputBackgroundColor ?? cardColor,
        }}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: 8, paddingBottom: 1 }}>
          {options.map((option) => {
            const active = value.trim().toLowerCase() === option.toLowerCase();
            return (
              <TouchableOpacity
                key={option}
                onPress={() => onChangeText(option)}
                activeOpacity={0.8}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: active ? primaryColor : borderColor,
                  backgroundColor: active ? primaryColor : "transparent",
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: active ? "#fff" : mutedIconColor,
                  }}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
