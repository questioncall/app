import { View, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";

export default function CallScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  return (
    <View className="flex-1 bg-black items-center justify-center">
      <Text className="text-white text-lg">Call Room</Text>
      <Text className="text-slate-400">{roomId}</Text>
    </View>
  );
}
