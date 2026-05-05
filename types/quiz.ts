export type QuizType = "FREE" | "PREMIUM";

export type QuizSessionStatus = "IN_PROGRESS" | "SUBMITTED";

export type QuizSubmitReason = "MANUAL" | "TIME_EXPIRED" | "ANTI_CHEAT";

export type QuizLevelCategory = "SCHOOL" | "PLUS_TWO" | "BACHELOR" | "OTHER";

export type QuizViolationType =
  | "FULLSCREEN_EXIT"
  | "TAB_HIDDEN"
  | "WINDOW_BLUR"
  | "PAGE_HIDE"
  | "BEFORE_UNLOAD"
  | "BACK_NAVIGATION"
  | "DUPLICATE_TAB";

export type QuizAnswerClient = {
  questionId: string;
  selectedOptionIndex: number | null;
  isCorrect?: boolean;
};

export type QuizQuestionClient = {
  id: string;
  questionText: string;
  options: string[];
  explanation?: string | null;
  correctOptionIndex?: number;
  selectedOptionIndex?: number | null;
  isCorrect?: boolean;
};

export type QuizTopicClient = {
  id: string;
  subject: string;
  topic: string;
  level: string;
  field?: string | null;
  levelCategory?: QuizLevelCategory;
  searchAliases?: string[];
  matchReason?: string | null;
  searchScore?: number;
  isActive: boolean;
  questionCount?: number;
};

export type QuizModeSummary = {
  dailyLimit: number;
  usedToday: number;
  remainingToday: number;
  passPercent: number;
  pointReward: number;
  isEligible: boolean;
  reason: string | null;
};

export type QuizActiveSessionSummary = {
  id: string;
  quizType: QuizType;
  subject: string;
  topic: string;
  level: string;
  startedAt: string;
  timerDeadline: string;
};

export type QuizHistoryItem = {
  id: string;
  quizType: QuizType;
  status: QuizSessionStatus;
  subject: string;
  topic: string;
  level: string;
  score: number;
  pointsAwarded: number;
  answeredCount: number;
  questionCount: number;
  violationCount: number;
  submitReason: QuizSubmitReason | null;
  startedAt: string;
  submittedAt: string | null;
};

export type QuizHistoryResponse = {
  items: QuizHistoryItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  activeSession: QuizActiveSessionSummary | null;
  free: QuizModeSummary;
  premium: QuizModeSummary;
  planSlug: string | null;
  subscriptionStatus: "ACTIVE" | "EXPIRED" | "NONE";
};

export type QuizSessionResponse = {
  id: string;
  quizType: QuizType;
  status: QuizSessionStatus;
  subject: string;
  topic: string;
  level: string;
  startedAt: string;
  timerDeadline: string;
  submittedAt: string | null;
  score: number;
  pointsAwarded: number;
  submitReason: QuizSubmitReason | null;
  violationCount: number;
  warningLimit: number;
  passPercent: number;
  pointReward: number;
  questionCount: number;
  answeredCount: number;
  questions: QuizQuestionClient[];
};

export type QuizStartResponse = {
  sessionId: string;
  reusedExistingSession: boolean;
  session?: QuizSessionResponse;
};
