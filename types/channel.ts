// ──────────────────────────────────────────────────────────
// Shared channel & message types — single source of truth
// ──────────────────────────────────────────────────────────

import type { AnswerFormat } from "@/types/question";

export type ChannelStatus = "ACTIVE" | "CLOSED" | "EXPIRED";
export type MessageMediaType = "TEXT" | "IMAGE" | "VIDEO" | "AUDIO";

// ──────────────────────────────────────────────────────────
// Channel shapes
// ──────────────────────────────────────────────────────────

/** Raw channel record shape (from DB) */
export type ChannelRecord = {
  id: string;
  questionId: string;
  askerId: string;
  acceptorId: string;
  openedAt: string;
  timerDeadline: string;
  timeExtensionCount: number;
  closedAt: string | null;
  status: ChannelStatus;
  isClosedByAsker: boolean;
  ratingGiven: number | null;
  createdAt: string;
  updatedAt: string;
};

/** Populated channel detail for the UI */
export type ChannelDetail = ChannelRecord & {
  questionTitle: string;
  questionBody: string;
  answerFormat: AnswerFormat;
  answerVisibility: string;
  askerName: string;
  askerUsername?: string;
  askerImage?: string;
  acceptorName: string;
  acceptorUsername?: string;
  acceptorImage?: string;
  formatDurationMinutes: number;
  maxVideoDurationMinutes: number;
  isAnswerSubmitted: boolean;
};

/** Lightweight channel shape for sidebar list */
export type ChannelListItem = {
  id: string;
  questionTitle: string;
  counterpartName: string;
  counterpartImage?: string;
  status: ChannelStatus;
  lastMessagePreview?: string;
  lastMessageAt?: string;
  unreadCount: number;
  timerDeadline: string;
  role: "asker" | "acceptor";
};

// ──────────────────────────────────────────────────────────
// Message shapes
// ──────────────────────────────────────────────────────────

/** Chat message shape for the UI */
export type ChatMessage = {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  content: string;
  mediaUrl: string | null;
  mediaType: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | null;
  isSystemMessage: boolean;
  isOwn: boolean;
  isSending?: boolean;
  isSeen: boolean;
  isDelivered?: boolean;
  isMarkedAsAnswer?: boolean;
  isDeleted?: boolean;
  sentAt: string;
  callInfo?: {
    callSessionId: string;
    mode: "AUDIO" | "VIDEO";
    status: "ENDED" | "REJECTED" | "MISSED";
    durationSeconds: number | null;
    callerName: string;
    callerId: string;
  } | null;
};

// ──────────────────────────────────────────────────────────
// API payloads
// ──────────────────────────────────────────────────────────

/** Body shape for POST /api/channels/[id]/messages */
export type SendMessagePayload = {
  content?: string;
  mediaUrl?: string;
  mediaType?: MessageMediaType;
  mediaPublicId?: string;
};

/** Response from the accept API — includes channelId for redirect */
export type AcceptQuestionResponse = {
  channelId: string;
  questionId: string;
  timerDeadline: string;
  formatDurationMinutes: number;
};
