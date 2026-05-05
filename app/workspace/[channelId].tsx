import { View, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";

export default function WorkspaceScreen() {
  const { channelId } = useLocalSearchParams<{ channelId: string }>();
  return (
    <View className="flex-1 bg-slate-950 items-center justify-center">
      <Text className="text-white text-lg">Workspace</Text>
      <Text className="text-slate-400">Channel: {channelId}</Text>
    </View>
  );
}
