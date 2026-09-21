# Phase 14: Comment Moderation & Reporting

## Overview
Phase 14 introduces a robust, enterprise-grade content moderation and reporting system for video comments and nested replies. This phase allows authenticated viewers to flag abusive, harassing, or spammy comments using standardized report categories, while empowering platform administrators to review reports, take granular moderation actions, and maintain a full audit trail.

All moderation operations adhere strictly to safety best practices:
- Original reply hierarchies and discussion threads are preserved when comments are moderated.
- Content is masked safely to protect viewer experience while avoiding broken reply trees.
- Translations of moderated content are immediately purged and blocked.
- All actions taken by administrators are permanently logged in an immutable audit ledger.

---

## Key Features

1. **Viewer Reporting Workflow**
   - Available on all visible comments and nested replies for authenticated viewers.
   - Non-owners can access a prominent `Report` action within the `⋮` comment options menu.
   - Unauthenticated visitors are prompted to sign in before submitting a report.
   - Self-reporting is strictly rejected (HTTP 400).
   - Duplicate active reports per user and comment are prevented (HTTP 409 Conflict).
   - Reports accept an optional description (up to 1,000 characters) for context.

2. **10 Standard Report Reason Categories**
   - `SPAM`: Unsolicited commercial content, repetitive messages, or scams.
   - `HARASSMENT`: Bullying, harassment, or threats targeted at individuals.
   - `HATE_SPEECH`: Attacks, slurs, or degradation based on protected characteristics.
   - `VIOLENCE`: Graphic violence, threats of harm, or dangerous content.
   - `MISINFORMATION`: Deceptive, manipulated, or demonstrably false information.
   - `SEXUAL_CONTENT`: Explicit or inappropriate sexual material.
   - `COPYRIGHT`: Infringement of intellectual property or unauthorized copyrighted material.
   - `SUICIDE_SELF_HARM`: Encouragement, depiction, or glorification of self-harm.
   - `TERRORISM`: Promotion or incitement of terrorism, violent extremism, or criminal acts.
   - `OTHER`: Other community guideline violations not covered above.
   - Exposed via `GET /api/reports/reasons` for dynamic UI dropdowns and client-side validation.

3. **Admin Moderation Queue**
   - Accessible to platform users with the `ADMIN` role at `/admin/moderation`.
   - Filter queue by status: `PENDING`, `REVIEWING`, `REVIEWED`, `ACTION_TAKEN`, `DISMISSED`, or `ALL`.
   - Filter by reason category and sort by newest or oldest reports.
   - Full-text search across comment content, video titles, author usernames, and reporter usernames.
   - Real-time display of report context: reported comment preview, author handle, reporter details, reporter notes, video link, and current comment status.

4. **Granular Moderation Actions**
   - **Dismiss Report (`DISMISSED`)**: Resolves false or benign flags with an optional note without altering the comment state.
   - **Mark Under Review (`REVIEWING` / `REVIEWED`)**: Indicates that an administrator is actively assessing the report.
   - **Hide Comment (`HIDE_COMMENT`)**:
     - Comment status becomes `HIDDEN`.
     - Normal viewers see the masked placeholder: *"This comment is currently unavailable."*
     - Original comment author and platform admins can still view original content with status badges.
     - Like and reply interactions are disabled.
     - Cached translations are immediately purged.
   - **Remove Comment (`REMOVE_COMMENT`)**:
     - Comment status becomes `REMOVED`.
     - Replaces public display text with *"This comment has been removed by a moderator."*
     - Author information is masked to `[removed]`.
     - Soft deletion ensures nested reply trees remain intact without orphaned replies.
     - Video and parent comment counters are safely decremented.
     - Cached translations are immediately purged.
   - **No Action (`NO_ACTION`)**: Closes the report without altering comment visibility.

5. **Translation Moderation Protection**
   - Moderation actions instantly execute `DELETE FROM comment_translations WHERE comment_id = ?`.
   - `POST /api/comments/:commentId/translate` and `GET /api/comments/:commentId/translation` reject requests on `REMOVED` or `HIDDEN` comments with `403 Forbidden` (`COMMENT_MODERATED`), preventing moderation evasion via foreign translations.

6. **Administrative Audit Ledger**
   - Every moderation decision is atomically recorded in `admin_actions`.
   - Records include Admin ID, action type (`HIDE_COMMENT`, `REMOVE_COMMENT`, `DISMISS_REPORT`, `REVIEW_REPORT`), target entity (`COMMENT` or `REPORT`), target ID, administrator reasoning, resolution notes, and IP address.
   - Dedicated "Audit Trail" tab in the Admin Moderation dashboard enables oversight and compliance tracking.

---

## Database Architecture

### Extended Tables
- **`comments`**:
  - `status`: `ENUM('VISIBLE', 'HIDDEN', 'DELETED', 'REPORTED', 'REMOVED') NOT NULL DEFAULT 'VISIBLE'`
- **`reports`**:
  - `status`: `ENUM('PENDING', 'REVIEWING', 'REVIEWED', 'DISMISSED', 'ACTION_TAKEN', 'RESOLVED', 'REJECTED') NOT NULL DEFAULT 'PENDING'`
  - `resolution_note`: `TEXT NULL`
  - `updated_at`: `TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
  - Added indexes: `idx_reports_reporter_comment (reporter_id, comment_id)` and `idx_reports_comment_id (comment_id)`
- **`admin_actions`**:
  - `reason`: `VARCHAR(255) NULL`
  - `metadata`: `JSON NULL`

---

## API Reference

### Viewer Endpoints

#### 1. Get Supported Report Reasons
- **Method / Path**: `GET /api/reports/reasons`
- **Auth**: Public
- **Response**:
```json
{
  "success": true,
  "reasons": [
    { "code": "SPAM", "label": "Spam or commercial advertising", "description": "..." },
    { "code": "HARASSMENT", "label": "Harassment or bullying", "description": "..." }
  ]
}
```

#### 2. Submit Comment Report
- **Method / Path**: `POST /api/comments/:commentId/reports`
- **Auth**: Required (`authenticateToken`)
- **Rate Limit**: 10 reports / 10 mins (`reportLimiter`)
- **Body**:
```json
{
  "reason": "HARASSMENT",
  "description": "Targeted harassment directed at the creator."
}
```
- **Responses**:
  - `201 Created`: Report filed successfully.
  - `400 Bad Request`: Invalid reason code, missing fields, or self-reporting.
  - `401 Unauthorized`: Guest viewer.
  - `403 Forbidden`: Video is private or processing.
  - `404 Not Found`: Comment does not exist.
  - `409 Conflict`: User has already reported this comment.

---

### Admin Endpoints (Requires `role === 'ADMIN'`)

#### 3. List Moderation Queue
- **Method / Path**: `GET /api/admin/reports`
- **Query Parameters**:
  - `page` (number, default: 1)
  - `limit` (number, default: 10, max: 50)
  - `status` (`PENDING`, `REVIEWING`, `REVIEWED`, `ACTION_TAKEN`, `DISMISSED`)
  - `reason` (standard category code)
  - `search` (text search in comment/author/reporter/video)
  - `sort` (`DESC` or `ASC`)

#### 4. Get Report Details
- **Method / Path**: `GET /api/admin/reports/:reportId`

#### 5. Review Report
- **Method / Path**: `POST /api/admin/reports/:reportId/review`
- **Body**: `{ "note": "Investigating comment history" }`

#### 6. Dismiss Report
- **Method / Path**: `POST /api/admin/reports/:reportId/dismiss`
- **Body**: `{ "note": "Content determined non-violative." }`

#### 7. Execute Moderation Action
- **Method / Path**: `POST /api/admin/reports/:reportId/action`
- **Body**:
```json
{
  "action": "REMOVE_COMMENT",
  "note": "Severe violation of community harassment policy."
}
```

#### 8. Retrieve Moderation Audit Logs
- **Method / Path**: `GET /api/admin/audit-logs`
- **Query Parameters**: `page`, `limit`

---

## Frontend Components

1. **`ReportCommentModal.jsx`**:
   - Radio selection for the 10 report reasons with descriptive helper text.
   - Optional detailed explanation textarea with 1,000-character limit counter.
   - Clean handling of duplicate report conflicts (`409 Conflict`).
   - Accessible keyboard controls (Esc to cancel, focus trap).

2. **`CommentItem.jsx` Extensions**:
   - `⋮` Options menu now appears for non-owners with a `Report` button.
   - Guest visitors clicking `Report` trigger the authentication prompt modal.
   - Moderated comments render specialized alert containers:
     - `REMOVED`: Rose border with `[removed by moderator]` and masked text.
     - `HIDDEN`: Amber border with `[unavailable]` and masked text.
   - Like, reply, and translate action bars are automatically hidden for moderated comments.

3. **`AdminModeration.jsx`**:
   - Moderation queue dashboard with status pills, reason filters, sort dropdown, and search.
   - Detailed report card view featuring video links, author handles, reporter notes, and status indicators.
   - Moderation action modal supporting `HIDE_COMMENT`, `REMOVE_COMMENT`, and `NO_ACTION`.
   - Tabbed administrative audit trail view with pagination.

4. **`AdminDashboard.jsx` Integration**:
   - Direct link card directing administrators to `/admin/moderation`.
   - Protected route registered at `/admin/moderation` for users with `ADMIN` privileges.
