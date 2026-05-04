# MOBILE_APP_HANDOFF

This document serves as the absolute source of truth for the React Native (Expo) mobile app development team. It provides an exhaustive, feature-by-feature breakdown of the **QuestionCall ** platform, ensuring zero ambiguity in replicating the web platform's functionality, business logic, security constraints, and UI/UX flows.

⚠️ **SECURITY CRITICAL:** This is a real-money platform involving financial transactions, wallet balances, and strict role-based access. Compliance, security, and parity are non-negotiable.


The legitimate ways to save builds:
Fix bugs using EAS Update (JavaScript changes = no new build needed)
Test on Expo Go during development, only build when truly needed
Make sure the app is properly tested before triggering a build
Pro tip to save builds: Use EAS Update for JavaScript-only changes — it lets you push updates to users without creating a new build at all. So bug fixes and UI tweaks? No build needed. Only rebuild when you change native code
---

## 1. Project Overview

**QuestionCall ()** is a dynamic, dual-portal educational platform connecting students with verified expert teachers.

- **Target Users:** Students (seeking academic help) and Teachers (providing answers, creating courses, and earning money).
- **Core Value Proposition:** 15-minute timed response system for fast doubt resolution, real-time 1-on-1 video/audio/chat, structured video courses, live sessions, AI quizzes, and an internal economy for teachers to monetize expertise.
- **Why It's a Real-Money App:** Teachers earn real money (tracked as "points" internally, converted to NPR at a configurable rate) into an internal wallet by answering questions, selling courses, or through referrals. They can withdraw this balance to actual bank accounts/wallets (eSewa, Khalti). Students can also earn points via quizzes and withdraw them.
- **Currency System:** The platform uses an internal "points" unit. Points convert to Nepalese Rupees (NPR) at a configurable `pointToNprRate` set in `PlatformConfig`. Teachers see their `pointBalance`, students see `points`. The mobile app must always display the NPR equivalent alongside the raw point value.
- **Web Tech Stack:** Next.js 14 (App Router), MongoDB (Mongoose), NextAuth.js, Pusher (real-time chat), LiveKit (video calls), Mux/Cloudinary (video streaming), Zod (validation), Redux Toolkit (state), Tailwind CSS + Shadcn (UI). Backend hosted on Vercel.

---

## 2. Mobile App Tech Stack (Recommended)

To maintain parity and maximize code sharing where possible, the mobile application MUST adhere to the following stack:

- **Framework:** React Native + Expo (SDK 51+ recommended)
- **Routing/Navigation:** `expo-router` (file-based routing, directly mirrors Next.js App Router mentality).
- **State Management:** `@reduxjs/toolkit` and `react-redux` (Matches the web platform's exact state logic). The web has 6 Redux slices: `auth`, `channel` (single active workspace), `channels` (list of all channels), `feed` (question feed), `upload` (file upload state), `user` (profile data). Mirror all 6.
- **Secure Storage:** `expo-secure-store` (Mandatory for JWT/Session tokens. **NEVER** use `AsyncStorage` for auth or financial tokens).
- **Real-Time Communication:** `pusher-js` (for WebSockets/chat) and `@livekit/components-react-native` (for video calls).
- **Video Playback:** `expo-video` or standard React Native video players optimized for HLS (Mux streams).
- **Required Expo Modules:**
  - `expo-notifications` (FCM/APNs push notifications)
  - `expo-local-authentication` (Biometric login for wallet withdrawals)
  - `expo-camera` / `expo-image-picker` (For uploading homework images and payment screenshots)
  - `expo-linking` (Deep linking)
  - `expo-document-picker` (For file attachments in chat)

---

## 3. Backend & API Integration

The Vercel-deployed Next.js backend will be reused entirely.

- **Base URL:** The URL of the Vercel deployment (e.g., `https://[production-domain].com/api`).
- **Communication:** Client will make REST API calls to `/api/...`.
- **CORS & Headers:**
  - Ensure the backend's `next.config.ts` or middleware allows CORS requests from the mobile app's origin if needed, although mobile apps generally bypass standard browser CORS policies.
  - Required headers: `Content-Type: application/json` and `Authorization: Bearer <token>` (if adapting NextAuth to mobile).
  - For manual payment screenshot uploads, use `Content-Type: multipart/form-data`.
- **Real-Time:**
  - **Pusher:** Used for live chat (`channels`), feed syncing, notifications, and admin real-time updates. Mobile networks drop WebSockets frequently — implement aggressive reconnect logic.
  - **LiveKit:** Used for 1-on-1 video/audio calls. You will request a token from the backend (`/api/calls/token`) and use it to connect to the LiveKit server.

### PlatformConfig — The Single Source of Truth

⚠️ **CRITICAL:** Nearly every business constant (answer durations, points per format, rating bonuses/penalties, quiz settings, commission percentages, subscription pricing, withdrawal minimums, etc.) is stored in the `PlatformConfig` MongoDB collection and is admin-configurable. The mobile app **MUST fetch config on startup** via the platform API and cache it. **NEVER hardcode these values.**

### Complete API Route Map

**Auth:**
- `POST /api/auth/register` — Email/password signup
- `POST /api/auth/[...nextauth]` — NextAuth login (needs mobile JWT bridge)
- `POST /api/auth/forgot-password` — Password reset request
- `POST /api/auth/verify-email` — Email verification

**Questions:**
- `GET /api/questions/feed` — Live question feed for teachers (excludes suspended users)
- `POST /api/questions` — Post a question (enforces plan question limits)
- `GET /api/questions/[id]` — Get question details
- `DELETE /api/questions/[id]` — Delete question (decrements `questionsAsked`)
- `POST /api/questions/[id]/accept` — Teacher accepts a question
- `POST /api/questions/[id]/react` — Add reaction to question

**Channels / Workspace:**
- `GET /api/channels` — List user's channels
- `GET /api/channels/[id]` — Get channel details
- `POST /api/channels/[id]/close` — Close/resolve a channel (triggers rating, potential reset, point rewards)

**Answers/Chat:**
- `POST /api/answers` — Submit answer
- Pusher-based real-time messaging within channels

**Calls:**
- `POST /api/calls/initiate` — Start a call
- `POST /api/calls/accept` — Accept incoming call
- `POST /api/calls/reject` — Reject incoming call

**Wallet & Money:**
- `GET /api/wallet` — Full wallet summary (balance, history, `pointToNprRate`, pending withdrawal)
- `POST /api/wallet/withdraw` — Request withdrawal (atomic Mongo transaction)

**Payments:**
- `POST /api/payments/esewa/initiate` — Start eSewa payment flow
- `GET /api/payments/esewa/verify` — Verify eSewa payment (redirect-based callback)
- `GET /api/payments/esewa/course-verify` — Verify eSewa course purchase
- `GET /api/payments/khalti/course-verify` — Verify Khalti course purchase
- `POST /api/payments/manual` — Submit manual payment (FormData with screenshot)

**Courses:**
- `GET /api/courses` — List courses
- `POST /api/courses` — Create course (teacher/admin)
- `GET /api/courses/[id]` — Course details
- `POST /api/courses/[id]/enroll` — Enroll in course

**Quiz:**
- `GET /api/quiz` — Quiz endpoints
- Quiz session management with anti-cheat tracking

**Other:**
- `GET /api/profile-questions` — User's question history
- `GET /api/ratings` — Rating endpoints
- `POST /api/referral` — Referral system
- `GET /api/search` — Search
- `GET /api/teachers/top-rated` — Top teachers list
- `GET /api/notices` — Platform-wide admin announcements
- `POST /api/push` — Push notification subscription
- `GET /api/legal` — Dynamic Terms of Use / Privacy Policy from DB
- `GET /api/platform` — Platform config for client
- `POST /api/upload` — File uploads (Cloudinary)
- `GET /api/notifications` — User notifications
- `GET /api/onboarding-video` — Role-specific onboarding videos

**Admin (if building admin panel in mobile):**
- `/api/admin/users` — User management
- `/api/admin/users/[id]/suspend` — Suspend/unsuspend user
- `/api/admin/withdrawals` — Process withdrawals

**Cron Jobs (server-side, but mobile must handle side-effects):**
- `POST /api/cron/expire-calls` — Auto-ends stale calls (mobile: handle sudden call termination)
- `POST /api/cron/expire-channels` — Closes timed-out workspaces (mobile: handle channel closing mid-chat)
- `POST /api/cron/monthly-rewards` — Awards monthly bonus to high-rated teachers (mobile: handle surprise wallet credit notification)

---

## 4. Authentication & Security

⚠️ **SECURITY CRITICAL:** Because this app handles real money and payments, auth is heavily scrutinized.

### Auth Flow
- **Current Web Auth:** NextAuth.js (Session Cookies, JWT).
- **Mobile Adaptation:** Since React Native doesn't handle cookies like a browser, you must intercept the NextAuth JWT or create a dedicated mobile-login endpoint on the backend that returns a raw JWT token. Store this token using `expo-secure-store`.
- **Registration Flow:**
  1. `POST /api/auth/register` with `name`, `email`, `password`, `role` (STUDENT or TEACHER)
  2. Optional: Referral code applied at signup → awards `bonusQuestions` to both referrer and referee
  3. Email verification via `/api/auth/verify-email`
- **Login Flow:**
  1. Login with Email/Password
  2. Receive JWT, store securely via `expo-secure-store`
  3. Attach `Authorization: Bearer <token>` to all subsequent Axios/Fetch requests
- **Password Reset:** `POST /api/auth/forgot-password` → email with reset link → deep link back to app

### Role-Based Access
The token contains the `role` field (`STUDENT`, `TEACHER`, `ADMIN`). The UI must conditionally render based on this role:
- **Students:** See "My Questions", quiz portal, course library, wallet (points from quizzes)
- **Teachers:** See "Question Feed", answer workspace, course studio, wallet (pointBalance from answers)
- **Admins:** See admin dashboard, user management, withdrawal processing

### Account Suspension
The `User.isSuspended` flag can be set by admins. When suspended:
- Teacher is excluded from question feed
- Cannot earn rewards or monthly bonuses
- Cannot make withdrawals
- The mobile app MUST check `isSuspended` on app launch and show a **full-screen "Account Suspended" screen** that blocks all functionality. Check this on every auth token refresh.

### Teacher Qualification & Monetization
- New teachers start with `teacherModeVerified: false` and `isMonetized: false`
- They must answer `qualificationThreshold` (configurable, default varies) test questions correctly
- Once verified, `isMonetized` flips to `true` and they begin earning points
- Mobile must show qualification progress and restrict wallet features until monetized

### Security Protections
- **Biometric Login:** Require Face ID / Fingerprint (`expo-local-authentication`) before users can access the Wallet tab, view transaction history, or request a withdrawal.
- Jailbreak/Root detection is highly recommended (`expo-dev-client` plugins or third-party libraries).
- Screenshot prevention on the Wallet/Withdrawal screens.

---

## 5. Feature-by-Feature Parity Checklist

### 5.1 Question Feed (Teachers) & Question Posting (Students)

**Student Posting Flow:**
1. Student taps "Ask Question"
2. Fills: title (6–180 chars), body (max 5000 chars), images (via `expo-image-picker`), subject, stream, level
3. Selects `answerFormat`: `TEXT`, `PHOTO`, `VIDEO`, or `ANY`
4. Selects `answerVisibility`: `PUBLIC` or `PRIVATE`
5. Backend checks question limits before accepting (see 5.1.1)
6. Question appears in live feed via Pusher

**Question Limit Enforcement (CRITICAL):**
- Each student has a `planSlug` (free/go/plus/pro/max) with a `maxQuestions` quota
- `questionsAsked` tracks usage in current subscription period
- `bonusQuestions` from referrals add to the effective limit
- If `questionsAsked >= effectiveLimit`, the backend returns 403 with remaining count
- If subscription is expired, backend resets `subscriptionStatus` and `questionsAsked`
- Deleting a question decrements `questionsAsked` (gives back quota)
- **Mobile must show:** remaining question count, "Upgrade Plan" CTA when limit reached

**Teacher Feed:**
- Questions sorted by `resetCount` (descending) then `createdAt` (descending) — reset questions get priority
- Feed excludes questions from suspended teachers
- Teacher taps "Accept" → strict countdown starts (duration depends on `answerFormat`, configurable per format in `PlatformConfig`)

**Question Reset / Re-Queue:**
- When a question gets a low rating (1-star), it can be re-opened for other teachers
- `resetCount` increments (up to `maxQuestionResetCount` from config)
- Reset questions appear higher in the feed
- Mobile UI should show "Attempt X of Y" badge on reset questions

### 5.2 Live Chat / Workspace (Answers)
- **Flow:** Both users enter a chat room. Powered by Pusher.
- **Features:** Text, image attachments, "Mark as Solved" button.
- **Mobile UX:** WhatsApp-style chat interface. Inverse scrolling (FlatList `inverted={true}`).
- **Channel close** triggers rating flow → points awarded/deducted based on rating

### 5.3 Video & Audio Calls
- **Flow:** User taps "Call" → Backend creates LiveKit room → Push notification wakes up the other user's app → Other user accepts → Connect to LiveKit room.
- **Tech:** `@livekit/components-react-native`.
- **Mobile UX:** Full-screen incoming call overlay (similar to WhatsApp/System calls).
- **Call Settings (user-configurable):**
  - `silentIncomingCalls` (boolean) — mute incoming call ringtone
  - `incomingRingtone` / `outgoingRingtone` — selectable from an enum of tones
  - Mobile needs a Settings screen for these preferences
- **Cron Side-Effect:** `expire-calls` cron auto-ends stale calls. Handle sudden call termination gracefully.

### 5.4 Video Courses & Live Sessions
- **Flow:** Students browse courses, pay via Wallet/Gateway, and watch videos.
- **Course Pricing Models:** `FREE`, `SUBSCRIPTION_INCLUDED` (requires active subscription), `PAID` (one-time NPR price)
- **Rule:** 90% watch time requirement (`courseProgressCompletionThreshold` from config) for section completion. Tracking must be implemented via intervals sent to the backend.
- **Tech:** Mux video player integration.
- **Course Sale Credits:** When a student buys a paid course, the instructor receives points (minus `coursePurchaseCommissionPercent` commission). This creates a `COURSE_SALE_CREDIT` transaction.
- **Live Sessions:** Redirect to Zoom app via Deep Link (`zoomus://`) or embed Zoom Mobile SDK.
- **Enrollment Access Types:** `FREE`, `SUBSCRIPTION`, `COUPON`, `PURCHASE` — each shows different badges in UI and determines if access persists when subscription expires.

**Course Coupon System:**
- Coupons have types: `FULL_ACCESS` (100% off) or `PERCENTAGE` (X% off)
- Scopes: `COURSE` (specific course) or `GLOBAL` (all paid courses)
- Have usage limits, expiry dates, case-insensitive unique codes
- Mobile needs a "Apply Coupon" input field on course purchase screens

### 5.5 AI Quizzes

**Flow:** User selects topic → Backend generates quiz via multi-LLM (Gemini/Groq/Mistral) → User answers → Gets score.

**Quiz Types:**
- `FREE` — limited daily sessions (`freeQuizDailySessionLimit`), lower rewards (`freeQuizPointReward`)
- `PREMIUM` — higher daily limits based on plan (`premiumQuizDailySessionLimitGo/Plus/Pro/Max`), higher rewards (`premiumQuizPointReward`)

**Quiz Config (all from PlatformConfig):**
- `quizQuestionCount` — number of questions per session
- `quizTimeLimitSeconds` — time limit
- `quizRepeatResetDays` — cooldown before retaking same topic
- `freeQuizPassPercent` / `premiumQuizPassPercent` — minimum score to earn points
- `quizViolationWarningLimit` — max anti-cheat violations before auto-submit

**Anti-Cheat System (CRITICAL for mobile):**
The web tracks these violation events:
- `FULLSCREEN_EXIT`, `TAB_HIDDEN`, `WINDOW_BLUR`, `PAGE_HIDE`, `BEFORE_UNLOAD`, `BACK_NAVIGATION`, `DUPLICATE_TAB`

**Mobile equivalents you MUST implement:**
- `TAB_HIDDEN` → App goes to background (`AppState` listener)
- `WINDOW_BLUR` → App loses focus
- `BACK_NAVIGATION` → Hardware back button during quiz
- `FULLSCREEN_EXIT` → N/A on mobile (ignore)
- `DUPLICATE_TAB` → N/A on mobile (ignore)

When `violationCount >= violationWarningLimit`, the quiz is auto-submitted with `submitReason: "ANTI_CHEAT"`.

### 5.6 Teacher-Student Anti-Cheat System
Separate from quiz anti-cheat. The `AntiCheatAlert` model tracks when the same teacher-student pair repeatedly collaborates (`consecutiveCount`). If threshold is exceeded (`antiCheatConsecutiveThreshold` from config), the teacher can be auto-suspended for `antiCheatSuspensionDays`. Mobile should display if user is flagged.

### 5.7 Peer Comments
Teachers above a configurable point threshold (`peerCommentPointThreshold`) can leave comments on other teachers' answers. They earn between `peerCommentMinPointReward` and `peerCommentMaxPointReward` points for helpful peer reviews.

### 5.8 Referral System
- Each user gets a unique `referralCode` (uppercase, unique)
- Sharing flow: generate a deep link `questioncall://register?ref=CODE`
- On signup with referral code:
  - **Referee** gets `referralBonusQuestions` bonus questions
  - **Referrer** gets `referrerBonusQuestions` bonus questions
- `bonusQuestions` add to the student's effective question quota
- Referral status: `COMPLETED` or `REVOKED`
- `User.referralHistory[]` tracks all referrals with points earned and dates
- Mobile needs a "Share Referral" screen with code + deep link share sheet

### 5.9 Notice System / Admin Broadcasts
Admins can push platform-wide announcements via the `Notice` model. `User.seenNotices[]` tracks which notices a user has dismissed. Mobile needs a banner/modal for unseen notices on app launch.

### 5.10 Onboarding Videos
`PlatformConfig.onboardingVideos` stores role-specific onboarding videos (title, description, videoUrl, thumbnailUrl). `User.seenOnboardingRoles[]` tracks which onboarding was watched. Mobile needs a first-run video experience per role.

---

## 6. Money / Transaction Handling

⚠️ **SECURITY CRITICAL**

### Internal Currency System
- **Teachers** earn `pointBalance` (from answering questions, course sales, bonuses)
- **Students** earn `points` (from quiz rewards)
- Both convert to NPR at `pointToNprRate` (configurable in PlatformConfig)
- The mobile wallet screen must show: `pointBalance × pointToNprRate = NPR equivalent`

### Earning Mechanisms (Teachers)
| Source | Points Earned | Config Field |
|--------|--------------|--------------|
| Text answer | Configurable | `pointsPerTextAnswer` |
| Photo answer | Configurable | `pointsPerPhotoAnswer` |
| Video answer | Configurable | `pointsPerVideoAnswer` |
| 2-star rating bonus | Configurable | `bonusPointsFor2Star` |
| 3-star rating bonus | Configurable | `bonusPointsFor3Star` |
| 4-star rating bonus | Configurable | `bonusPointsFor4Star` |
| 5-star rating bonus | Configurable | `bonusPointsFor5Star` |
| Low rating (1-star) penalty | Negative | `penaltyPointsForLowRating` |
| Monthly high-rating bonus | Configurable | `monthlyHighScoreBonusPoints` |
| Daily target bonuses | Tiered | `dailyTargets[]` array |
| Course sale credit | Price minus commission | `coursePurchaseCommissionPercent` |

### Daily Target Bonus System
Teachers have daily answer targets with tiered bonuses (default):
| Target (answers/day) | Bonus Points |
|----------------------|-------------|
| 20 | 5 |
| 40 | 10 |
| 80 | 20 |
| 100 | 25 |

- `dailyAnswersCount` tracks today's answers (resets daily via `lastAnsweredDate`)
- `dailyTargetsAchieved[]` tracks which tiers were already claimed today
- Mobile needs a **progress tracker widget** in the teacher dashboard

### Wallet History Events
The `WalletHistoryEvent` model logs all balance changes with types:
`ANSWER_REWARD`, `AUTO_CLOSE_REWARD`, `LOW_RATING_PENALTY`, `TIMEOUT_PENALTY`, `MONTHLY_BONUS`, `DAILY_TARGET_BONUS`

### Transaction Types
The `Transaction` model tracks payment-level events:
`CREDIT`, `DEBIT`, `WITHDRAWAL`, `SUBSCRIPTION_MANUAL`, `COURSE_PURCHASE`, `COURSE_SALE_CREDIT`

### Withdrawal Flow

⚠️ **SECURITY CRITICAL — Atomic Transaction**

1. User enters amount to withdraw + eSewa number
2. Backend runs inside `mongoose.startSession()` + `withTransaction()`:
   - Checks no existing PENDING withdrawal (partial unique index enforces this)
   - Atomically deducts from user's balance (`pointBalance` for teachers, `points` for students)
   - Creates `WithdrawalRequest` with `pointsReserved: true`
   - Calculates `nprEquivalent = pointsRequested × pointToNprRate` (locked at time of request)
3. Notifies all admins via Pusher + in-app notification + email to master admins
4. Admin manually processes via eSewa, fills `transactionId`, `amountSent`, marks COMPLETED/REJECTED
5. If REJECTED, points are refunded

**Mobile MUST:**
- Show "You already have a pending request" and disable withdraw button when one exists
- Handle the duplicate error (HTTP 400 or Mongo 11000 error code) gracefully
- Show the locked NPR rate on pending withdrawals
- Never attempt client-side balance math
- Enforce minimum withdrawal: `minWithdrawalPoints` from config
- Allow saving eSewa number (`saveEsewaNumber` flag)

### Payment Gateways

**eSewa (redirect-based):**
1. `POST /api/payments/esewa/initiate` — returns redirect URL
2. User completes payment in eSewa app/WebView
3. eSewa redirects to success URL → `GET /api/payments/esewa/verify`
4. For courses: `GET /api/payments/esewa/course-verify`
- **Mobile:** Open a secure WebView, intercept the success redirect deep link

**Khalti (redirect-based):**
1. Similar redirect flow
2. `GET /api/payments/khalti/course-verify` for course purchases
- **Mobile:** Same WebView + deep link interception pattern

**Manual Payment (eSewa transfer + screenshot):**
1. Mobile shows admin's eSewa number + QR code (from `PlatformConfig.manualPaymentQrCodeUrl`)
2. User transfers money outside the app
3. User submits via `POST /api/payments/manual` with FormData:
   - `transactionId` (string) — the eSewa transaction ID
   - `transactorName` (string) — name on the eSewa account
   - `planSlug` (string) — which plan they're paying for
   - `screenshot` (File, optional) — proof of payment uploaded to Cloudinary
4. **Smart Typo Fix:** Re-submitting same `transactionId` from same user just updates the PENDING record (doesn't create duplicate)
5. **Duplicate Check:** If same `transactionId` is already COMPLETED, returns 409 Conflict
6. Admin reviews and approves/rejects

### Subscription Plans

| Plan | Price (NPR) | Questions | Duration | Quiz Limit |
|------|------------|-----------|----------|-----------|
| Free (Trial) | 0 | Configurable | Configurable days | Free quizzes only |
| Go | Configurable | Configurable | Configurable days | Per-plan premium limit |
| Plus | Configurable | Configurable + 10 free | Configurable days | Per-plan premium limit |
| Pro | Configurable | Configurable + 20 free | Configurable days | Per-plan premium limit |
| Max | Configurable | Configurable + 50 free | Configurable days | Per-plan premium limit |

All pricing, limits, and durations are admin-configurable via `PlatformConfig`. Fetch via API.

---

## 7. Data Models & TypeScript Types

The web platform heavily utilizes Mongoose schemas and Zod. The mobile app MUST use the exact same TypeScript interfaces.

**All Models (34 total) — export types from backend:**

| Model | Key Fields | Money-Related |
|-------|-----------|---------------|
| `User` | role, points, pointBalance, subscriptionStatus, planSlug, questionsAsked, bonusQuestions, isSuspended, isMonetized, teacherModeVerified, dailyAnswersCount, dailyTargetsAchieved, esewaNumber, callSettings | ✅ |
| `Question` | askerId, title, body, images, answerFormat, answerVisibility, status (OPEN/ACCEPTED/SOLVED), resetCount, acceptedById, acceptedAt | |
| `Answer` | questionId, teacherId, content | |
| `Channel` | participants, question reference | |
| `Message` | channelId, senderId, content, attachments | |
| `CallSession` | channelId, roomName, teacherId, studentId, mode (AUDIO/VIDEO), status (CREATED/RINGING/ACTIVE/ENDED/REJECTED/MISSED) | |
| `Transaction` | userId, type, amount, status (PENDING/COMPLETED/FAILED), gateway (ESEWA/INTERNAL/MANUAL/KHALTI), transactionId, planSlug, screenshotUrl | ✅ |
| `WithdrawalRequest` | teacherId, pointsRequested, nprEquivalent, esewaNumber, status (PENDING/COMPLETED/REJECTED), pointsReserved, transactionId, amountSent, processedBy | ✅ |
| `WalletHistoryEvent` | userId, type, title, pointsDelta, occurredAt | ✅ |
| `Course` | title, slug, pricingModel (FREE/SUBSCRIPTION_INCLUDED/PAID), price, currency (NPR), status, instructorId | ✅ |
| `CourseEnrollment` | courseId, studentId, accessType (FREE/SUBSCRIPTION/COUPON/PURCHASE), pricePaid, overallProgressPercent | ✅ |
| `CourseVideo` | courseId, sectionId, title, duration | |
| `CourseSection` | courseId, title, order | |
| `CourseCoupon` | code, type (FULL_ACCESS/PERCENTAGE), scope (COURSE/GLOBAL), discountPercentage, usageLimit, expiryDate | ✅ |
| `CourseCouponRedemption` | couponId, studentId, courseId | |
| `LiveSession` | courseId, title, zoomLink, scheduledAt | |
| `QuizSession` | studentId, quizType (FREE/PREMIUM), topicId, answers, score, pointsAwarded, violationCount, violationEvents, configSnapshot, submitReason (MANUAL/TIME_EXPIRED/ANTI_CHEAT) | ✅ |
| `QuizQuestion` | question, options, correctIndex | |
| `QuizTopic` | subject, topic, level | |
| `Referral` | referrerId, refereeId, referralCode, bonusAwarded, status (COMPLETED/REVOKED) | ✅ |
| `Notification` | userId, type, message, href, isRead | |
| `PeerComment` | answerId, commenterId, content | |
| `AntiCheatAlert` | teacherId, studentId, consecutiveCount, status (WARNING/SUSPENDED) | |
| `Notice` | title, content (admin broadcasts) | |
| `PlatformConfig` | ~50+ configurable fields (see Section 3) | ✅ |
| `PushSubscription` | userId, subscription endpoint | |
| `VideoProgress` | userId, videoId, watchedPercent | |
| `ErrorLog` | error tracking | |
| `ApiRequestLog` | request logging | |
| `AIProviderConfig` | LLM key rotation | |
| `DeveloperConfig` | dev settings | |
| `CourseNotificationLog` | notification dedup | |
| `VerificationToken` | email verification | |
| `QuizGenerationLog` | quiz generation tracking | |

**Type files to sync from web repo:**
- `types/channel.ts` — Channel-related interfaces
- `types/question.ts` — Question-related interfaces
- `types/quiz.ts` — Quiz-related interfaces
- `types/next-auth.d.ts` — Session type augmentation

*Copy the entire `types/` folder from the web repository into the React Native codebase.*

---

## 8. Design System & UI Guidelines

- **Aesthetics:** The web app uses a premium, glassmorphism-heavy design with subtle animations and dark/light modes.
- **Color Palette & Typography:** Extract CSS variables from `globals.css` and map them to a mobile theme object.
- **Recommended Library:** `NativeWind` (Tailwind for React Native) to easily migrate web classes, OR a customized `Restyle` / `Tamagui` setup.
- **Components:**
  - Web `Shadcn` Modals → React Native Bottom Sheets (`@gorhom/bottom-sheet`).
  - Web Toasts (`sonner`) → `react-native-toast-message`.
  - Web Dropdowns (`radix-ui`) → React Native `@react-native-picker/picker` or custom bottom sheets.
  - Web Accordions (FAQ, course sections) → `react-native-collapsible` or custom animated views.
- **Key Screens to Build:**
  - Suspended account screen (full-screen blocker)
  - Onboarding video player (per role, first-run)
  - Question quota indicator (remaining questions badge)
  - Daily target progress widget (teacher dashboard)
  - Referral sharing screen (code + deep link)
  - Manual payment screen (QR code display + screenshot upload)
  - Pending withdrawal status card
  - Admin notice banner/modal

---

## 9. Push Notifications, Deep Links & Background Tasks

### Push Notifications
- The web uses VAPID / Web Push. The mobile app MUST use Firebase Cloud Messaging (FCM) for Android and APNs for iOS via `expo-notifications`.
- **Backend Update Required:** The push logic (`/api/push/...`) and `PushSubscription` model will need to support FCM device tokens alongside/instead of VAPID web push subscriptions. Add a `platform` field (`web` / `ios` / `android`) to the `PushSubscription` model.
- **Notification Types to Handle:**
  - New question in feed (teacher)
  - Question accepted (student)
  - Incoming call (full-screen call UI)
  - Withdrawal processed (wallet update)
  - Monthly bonus awarded
  - Daily target achieved
  - Admin notice/broadcast
  - Course live session starting soon

### Deep Links
Configure `expo-linking` to handle these schemes:
- `questioncall://course/[id]` → Course detail screen
- `questioncall://workspace/[channelId]` → Chat workspace
- `questioncall://wallet` → Wallet screen
- `questioncall://quiz/[topicId]` → Quiz session
- `questioncall://register?ref=CODE` → Signup with referral code
- `questioncall://payment/success` → Payment verification callback
- `questioncall://payment/failure` → Payment failure handler

### Background Tasks
- If a question timer is running, use local notifications to alert the teacher when time is almost up, even if the app is backgrounded.
- Quiz sessions: detect app backgrounding via `AppState` API and report as violation event.
- Video watch tracking: pause progress tracking when app goes to background or phone is locked.

---

## 10. Environment Variables & Config

Mobile `.env` (managed via `expo-env` or `react-native-dotenv`):

```env
EXPO_PUBLIC_API_URL=https://[production-domain].com/api
EXPO_PUBLIC_PUSHER_KEY=[your_pusher_key]
EXPO_PUBLIC_PUSHER_CLUSTER=[your_pusher_cluster]
EXPO_PUBLIC_LIVEKIT_URL=[your_livekit_url]
EXPO_PUBLIC_ESEWA_MERCHANT_ID=[esewa_merchant_id]
EXPO_PUBLIC_KHALTI_PUBLIC_KEY=[khalti_public_key]
# DO NOT bundle NextAuth secrets, DB URIs, or API keys in the mobile app.
# All sensitive operations happen server-side via API calls.
```

**Switching Environments:**
- Use EAS Build profiles (`development`, `staging`, `production`) with separate `.env` files
- `eas.json` should define environment-specific `EXPO_PUBLIC_API_URL` values

---

## 11. Testing & QA Requirements

**Critical User Journeys (CUJs) to test:**

| # | Journey | Priority |
|---|---------|----------|
| 1 | Post question → Accept → Chat → Solve → Rating → Wallet Credit | 🔴 Critical |
| 2 | Withdrawal request → Admin approval → Balance update | 🔴 Critical |
| 3 | Manual payment with screenshot → Admin verification → Subscription active | 🔴 Critical |
| 4 | eSewa/Khalti payment flow and WebView redirect return | 🔴 Critical |
| 5 | Token refresh & session persistence on app restart | 🔴 Critical |
| 6 | Suspended account → blocked from all features | 🔴 Critical |
| 7 | Question limit reached → upgrade CTA shown | 🟡 Important |
| 8 | Quiz anti-cheat: backgrounding triggers violation | 🟡 Important |
| 9 | Video call connection on cellular vs. Wi-Fi | 🟡 Important |
| 10 | Course purchase with coupon code | 🟡 Important |
| 11 | Referral code signup → bonus questions awarded | 🟡 Important |
| 12 | Daily target progress → bonus awarded at threshold | 🟡 Important |
| 13 | Duplicate withdrawal attempt → proper error shown | 🟡 Important |
| 14 | Onboarding video shown on first login per role | 🟢 Minor |
| 15 | Admin notice displayed and dismissible | 🟢 Minor |

**Tools:** `Jest` for unit testing Redux slices, `Maestro` or `Detox` for E2E testing flows.

---

## 12. Build, Release & Store Submission

- **Build:** Use EAS Build (`eas build --profile production --platform all`).
- **Store Policies (CRITICAL):**
  - Because users earn money, Apple and Google will heavily scrutinize the app.
  - You must clearly outline the business model (who pays who) in the review notes.
  - Ensure digital purchases (like buying a course) comply with Apple/Google In-App Purchase rules (you may need to use RevenueCat for iOS if Apple rejects third-party gateways for digital goods, or classify it as a physical/real-world service).
  - The app handles real NPR currency. Clearly disclose this is an educational platform with teacher compensation, NOT gambling.
  - Include Terms of Use and Privacy Policy (fetched dynamically from `PlatformConfig.termsOfUseContent` / `privacyPolicyContent`). These are admin-editable markdown — render them dynamically, do NOT bundle static text.

---

## 13. Known Pitfalls & Gotchas

| Web Pattern | Mobile Equivalent | Notes |
|------------|-------------------|-------|
| `httpOnly` cookies (NextAuth) | Bearer JWT via `expo-secure-store` | Must build a JWT bridge endpoint on backend |
| `localStorage` / `sessionStorage` | `AsyncStorage` (non-sensitive) / `expo-secure-store` (sensitive) | Never store tokens in AsyncStorage |
| `window.location.href` redirects | `expo-linking` / `expo-router` navigation | Payment callbacks especially |
| `document.fullscreenElement` | N/A on mobile | Quiz anti-cheat: skip this check |
| `document.hidden` / `visibilitychange` | `AppState` API (`active`/`background`/`inactive`) | Quiz anti-cheat: map to TAB_HIDDEN |
| `window.onbeforeunload` | `AppState` change to `background` | Map to BEFORE_UNLOAD violation |
| `setInterval` for video tracking | `setInterval` + `AppState` pause | Must pause when backgrounded |
| Pusher WebSockets | Same library, aggressive reconnect | Mobile networks drop sockets frequently |
| Cloudinary upload (server-side) | Same API, but screenshots use FormData from mobile | Manual payment screenshot upload |
| `next-themes` (dark/light mode) | `useColorScheme()` from React Native | Map CSS variables to theme object |
| Web Push (VAPID) | FCM (Android) + APNs (iOS) via `expo-notifications` | Backend needs to support both |
| `PlatformConfig` server-side cache | Fetch on app launch + cache in Redux | Never hardcode configurable values |
| `sonner` toasts | `react-native-toast-message` | Same UX patterns |
| Shadcn modals/dialogs | `@gorhom/bottom-sheet` | Bottom sheets feel more native on mobile |

---

## 14. Folder Structure Recommendation

```text
/mobile-app
├── src/
│   ├── app/                    # expo-router file-based routing
│   │   ├── (auth)/             # Login, signup, forgot-password
│   │   ├── (tabs)/             # Bottom tab navigator
│   │   │   ├── feed/           # Question feed (teachers)
│   │   │   ├── my-questions/   # Student's questions
│   │   │   ├── courses/        # Course library
│   │   │   ├── wallet/         # Wallet, transactions, withdrawal
│   │   │   ├── profile/        # User profile, settings
│   │   ├── workspace/          # Chat workspace, LiveKit rooms
│   │   ├── quiz/               # Quiz sessions
│   │   ├── course/[id]/        # Course detail, video player
│   │   ├── payment/            # Payment WebViews, manual payment
│   │   ├── studio/             # Course creation (teacher/admin)
│   │   ├── admin/              # Admin panel (if included)
│   │   ├── suspended.tsx       # Suspension blocker screen
│   │   ├── onboarding.tsx      # Role-based onboarding video
│   ├── components/             # Reusable UI (Buttons, Bottom Sheets, Cards)
│   │   ├── shared/             # Cross-feature components
│   │   ├── wallet/             # Wallet-specific components
│   │   ├── quiz/               # Quiz-specific components
│   │   ├── chat/               # Chat message components
│   ├── store/                  # Redux Toolkit
│   │   ├── store.ts            # Store configuration
│   │   ├── hooks.ts            # Typed useAppSelector/useAppDispatch
│   │   ├── features/
│   │   │   ├── auth/           # Auth state, token management
│   │   │   ├── user/           # User profile, settings
│   │   │   ├── feed/           # Question feed state
│   │   │   ├── channel/        # Active workspace state
│   │   │   ├── channels/       # All channels list
│   │   │   ├── upload/         # File upload state
│   │   │   ├── config/         # PlatformConfig cache
│   ├── hooks/                  # Custom hooks
│   │   ├── usePusher.ts        # Pusher connection + reconnect
│   │   ├── useLiveKit.ts       # LiveKit room management
│   │   ├── useAppState.ts      # App foreground/background detection
│   │   ├── useBiometrics.ts    # Biometric auth for wallet
│   ├── services/               # API layer
│   │   ├── api.ts              # Axios instance with Bearer token interceptor
│   │   ├── auth.ts             # Auth API calls
│   │   ├── wallet.ts           # Wallet/payment API calls
│   │   ├── questions.ts        # Question API calls
│   │   ├── courses.ts          # Course API calls
│   │   ├── quiz.ts             # Quiz API calls
│   │   ├── notifications.ts    # Push notification setup
│   ├── types/                  # Exact copy of backend TS interfaces
│   ├── theme/                  # Colors, typography, spacing (from globals.css)
│   ├── constants/              # App-wide constants
│   ├── utils/                  # Helpers (formatting, validation)
├── app.json                    # Expo config (bundle ID, permissions)
├── eas.json                    # EAS Build profiles (dev/staging/prod)
├── .env
├── .env.staging
├── .env.production
```

---

## Final Handoff Checklist for Mobile Dev

### 🔴 Must-Have Before Launch
- [ ] API Base URL configured and pointing to Vercel backend
- [ ] Authentication successfully converted from Cookies to Bearer JWT
- [ ] `isSuspended` check on app launch — shows blocker screen
- [ ] Teacher qualification/monetization state correctly gates wallet features
- [ ] Pusher sockets connecting with aggressive reconnect on mobile networks
- [ ] LiveKit audio/video permissions and connections working
- [ ] Wallet balances match the website exactly (points × pointToNprRate = NPR)
- [ ] Withdrawal flow: atomic, one-pending-at-a-time, minimum enforced
- [ ] eSewa/Khalti payment via secure WebView with redirect interception
- [ ] Manual payment with screenshot upload working
- [ ] Question posting respects plan limits (questionsAsked vs effectiveLimit)
- [ ] Quiz anti-cheat: app backgrounding triggers violation event
- [ ] All business constants fetched from PlatformConfig API (never hardcoded)

### 🟡 Must-Have Before App Store Review
- [ ] Biometric auth required before wallet/withdrawal access
- [ ] Screenshot prevention on wallet screens
- [ ] Terms of Use and Privacy Policy rendered dynamically from DB
- [ ] Deep links working for all payment callbacks and referral codes
- [ ] Push notifications (FCM/APNs) delivering for all event types
- [ ] Admin notice system showing unseen announcements
- [ ] Onboarding video shown on first login per role
- [ ] Call settings (ringtone, silent mode) configurable in settings

### 🟢 Should-Have for Feature Parity
- [ ] Daily target progress tracker in teacher dashboard
- [ ] Course coupon code input on purchase screens
- [ ] Peer comment system for qualified teachers
- [ ] Referral sharing screen with deep link generation
- [ ] Question reset badge showing "Attempt X of Y"
- [ ] Subscription plan comparison with current quota display
- [ ] All 6 Redux slices (auth, user, feed, channel, channels, upload) mirrored
- [ ] Cron side-effects handled (sudden call end, channel close, surprise credits)
