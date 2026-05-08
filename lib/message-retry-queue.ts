import * as SecureStore from "expo-secure-store";
import { ChatMessage } from "@/store/slices/channelSlice";

const RETRY_KEY = "message_retry_queue";

export interface PendingMessage {
  localId: string;
  channelId: string;
  content?: string;
  mediaUrl?: string;
  mediaType?: string;
  createdAt: string;
}

function toPending(msg: ChatMessage): PendingMessage | null {
  if (!msg.localId || !msg.channelId) return null;
  return {
    localId: msg.localId,
    channelId: msg.channelId,
    content: msg.content || undefined,
    mediaUrl: msg.mediaUrl ?? undefined,
    mediaType: msg.mediaType ?? undefined,
    createdAt: msg.sentAt,
  };
}

async function readQueue(): Promise<PendingMessage[]> {
  try {
    const raw = await SecureStore.getItemAsync(RETRY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: PendingMessage[]): Promise<void> {
  try {
    const json = JSON.stringify(queue);
    if (json.length > 2048) {
      queue.splice(0, queue.length - 10);
    }
    await SecureStore.setItemAsync(RETRY_KEY, JSON.stringify(queue));
  } catch {
    // silent
  }
}

export async function enqueueFailedMessage(msg: ChatMessage): Promise<void> {
  const pending = toPending(msg);
  if (!pending) return;
  const queue = await readQueue();
  if (queue.some((m) => m.localId === pending.localId)) return;
  queue.push(pending);
  await writeQueue(queue);
}

export async function dequeueMessage(localId: string): Promise<void> {
  const queue = await readQueue();
  await writeQueue(queue.filter((m) => m.localId !== localId));
}

export async function getFailedMessages(channelId: string): Promise<PendingMessage[]> {
  const queue = await readQueue();
  return queue.filter((m) => m.channelId === channelId);
}

export async function clearChannelQueue(channelId: string): Promise<void> {
  const queue = await readQueue();
  await writeQueue(queue.filter((m) => m.channelId !== channelId));
}
