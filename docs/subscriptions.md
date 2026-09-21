# Phase 15 — Subscription System Foundation

## 1. Overview
Phase 15 introduces the complete tier and subscription foundation for StreamWave (`FREE`, `BRONZE`, `SILVER`, `GOLD`). It provides the data model, API endpoints, authorization middleware, transition history, and administrative management pages needed to govern user quotas and premium capabilities before payment gateway integration (Phase 16).

---

## 2. Tier Hierarchy & Quotas

| Tier Code | Plan Name | Monthly (INR) | Yearly (INR) | Max Uploads | Cloud Storage | Download Limit | Priority Support |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `FREE` | Free Starter | ₹0 | ₹0 | 10 videos | 5 GB | 0 / month | ❌ |
| `BRONZE` | Bronze Creator | ₹199 | ₹1,999 | 100 videos | 50 GB | 20 / month | ❌ |
| `SILVER` | Silver Pro | ₹499 | ₹4,999 | 500 videos | 250 GB | 100 / month | ❌ |
| `GOLD` | Gold VIP | ₹999 | ₹9,999 | Unlimited (0) | Unlimited (0) | Unlimited (0) | ✅ |

### Tier Rank Evaluation
The middleware (`subscriptionMiddleware.js`) defines numerical hierarchy ranks:
```js
const PLAN_RANKS = {
  FREE: 0,
  BRONZE: 1,
  SILVER: 2,
  GOLD: 3,
};
```
Endpoints guarded with `requirePlan('SILVER')` automatically grant access to both `SILVER` and `GOLD` subscribers while rejecting `FREE` or `BRONZE` with `403 Forbidden` and `requiredPlan` metadata.

---

## 3. Database Schema

### `subscription_plans`
Stores platform tier definitions and quotas:
- `id` (INT PK AUTO_INCREMENT)
- `name` (VARCHAR(50))
- `slug` (VARCHAR(50) UNIQUE)
- `code` (VARCHAR(30) UNIQUE) - e.g. `FREE`, `BRONZE`, `SILVER`, `GOLD`
- `description` (TEXT)
- `price` / `monthly_price` (DECIMAL(10,2))
- `yearly_price` (DECIMAL(10,2))
- `max_video_uploads` (INT) - `0` represents unlimited
- `max_storage_gb` (INT) - `0` represents unlimited
- `max_playlists` (INT)
- `download_limit` (INT)
- `duration_days` (INT DEFAULT 30)
- `premium_access` (TINYINT(1))
- `priority_support` (TINYINT(1))
- `status` (`ACTIVE`, `DISABLED`, `HIDDEN`)
- `created_at`, `updated_at`

### `user_subscriptions`
Stores active or past user subscriptions:
- `id` (INT PK AUTO_INCREMENT)
- `user_id` (INT FK -> users.id)
- `plan_id` (INT FK -> subscription_plans.id)
- `status` (`ACTIVE`, `EXPIRED`, `CANCELLED`, `PENDING`)
- `start_date` (DATETIME)
- `end_date` (DATETIME)
- `auto_renew` (TINYINT(1) DEFAULT 1)
- `payment_provider` (VARCHAR(50)) - `SYSTEM`, `DEMO`, or future `RAZORPAY`
- `payment_reference` (VARCHAR(255))
- `created_at`, `updated_at`

### `subscription_history`
Maintains immutable audit records of all plan transitions:
- `id` (INT PK AUTO_INCREMENT)
- `user_id` (INT FK -> users.id)
- `previous_plan_id` (INT NULL FK -> subscription_plans.id)
- `new_plan_id` (INT FK -> subscription_plans.id)
- `action` (`ASSIGNED`, `UPGRADED`, `DOWNGRADED`, `RENEWED`, `CANCELLED`, `EXPIRED`)
- `reason` (VARCHAR(255))
- `created_at` (DATETIME)

---

## 4. API Endpoints

### Public Endpoints
- `GET /api/subscriptions/plans`: Lists all active public subscription plans and quotas.

### Authenticated Endpoints (`authMiddleware`)
- `GET /api/subscriptions/current`: Fetches the caller's active subscription, tier quotas, and estimated usage meters (uploads count, estimated storage used). Auto-initializes `FREE` if not yet present.
- `POST /api/subscriptions/change`: Instant upgrade/downgrade gated by `SUBSCRIPTION_DEMO_MODE=true`. Atomically switches active tier and logs transition in `subscription_history`.
- `GET /api/subscriptions/history`: Returns paginated history of caller's plan changes.

### Admin Endpoints (`adminOnly`)
- `GET /api/admin/subscriptions/plans`: Lists all plans including administrative stats and subscriber counts.
- `PUT /api/admin/subscriptions/plans/:planId`: Updates plan limits, pricing, and active/disabled status.
- `GET /api/admin/subscriptions/stats`: Provides platform telemetry including total subscribers, paid subscribers, and estimated monthly recurring revenue (MRR).
- `GET /api/admin/subscriptions/users`: Returns paginated list of all users and their current subscription status.

---

## 5. Middleware Usage
To guard routes based on subscription tier:
```js
const { requirePlan, requireFeature } = require('../middleware/subscriptionMiddleware');

// Route requires at least SILVER tier
router.post('/vip-action', authMiddleware, requirePlan('SILVER'), controller.action);

// Route requires specific feature flag
router.get('/priority-queue', authMiddleware, requireFeature('priority_support'), controller.queue);
```

---

## 6. Frontend Integration
1. **User Subscription Hub (`/subscriptions`)**:
   - Primary **Membership Plans** tab displays current plan badge, renewal details, and interactive usage meters (uploads and storage).
   - Dynamic tier cards with active plan tags, upgrade/downgrade buttons, and detailed feature lists.
   - Tier Comparison Table contrasting features across all 4 tiers.
   - Upgrade/Downgrade Confirmation Modal showing old vs new plan and changes.
   - Activity History log table with status badges and timestamps.
   - Preserved **Followed Channels** tab retaining Phase 1 creator channel subscription listing.
2. **Admin Subscription Management (`/admin/subscriptions`)**:
   - Plan configuration editor for editing prices, video upload limits, storage caps, download limits, and active status.
   - Platform telemetry cards displaying total subscribers, paid ratio, and MRR.
   - Real-time subscriber users directory.
