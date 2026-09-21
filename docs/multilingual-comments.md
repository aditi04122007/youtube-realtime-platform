# Phase 13: Multilingual Comment Translation

## Overview
Phase 13 introduces an on-demand, caching-enabled multilingual translation system for video comments and nested replies. This feature enables viewers from diverse linguistic backgrounds to translate user comments into 15+ regional and global languages while guaranteeing high performance, security, and zero data loss.

Translations operate **purely as a view-level enhancement**; original comment content stored in MySQL is immutable to translations. Cached translations are stored in a dedicated `comment_translations` table indexed for fast retrieval and equipped with SHA-256 content verification to prevent stale translations.

---

## Key Features

1. **On-Demand Translation for Comments & Replies**
   - Available on all visible top-level comments and nested reply threads.
   - Clean `[Translate]` button integrated into the comment action bar (alongside Like and Reply).
   - Instant switching between translated content and original text via the `[See original]` toggle.
   - Distinct `Translated from {language}` indicator with cached status badge.
   - Independent per-comment translation state: translating one comment never impacts any other comment in the discussion.

2. **Centralized Supported Languages Registry**
   - 15+ regional Indian languages and major international languages:
     - English (`en`), Hindi (`hi`), Marathi (`mr`), Tamil (`ta`), Telugu (`te`), Bengali (`bn`), Gujarati (`gu`), Kannada (`kn`), Malayalam (`ml`), Punjabi (`pa`), Spanish (`es`), French (`fr`), German (`de`), Arabic (`ar`), Japanese (`ja`).
   - Accessible to the client via `GET /api/translations/languages`.
   - Single in-memory request caching on the frontend ensures minimal network overhead.

3. **Provider Abstraction & Developer Mode**
   - Clean provider architecture in `backend/services/translationService.js` and `backend/services/translationProviders/libreTranslateProvider.js`.
   - In development mode (`TRANSLATION_PROVIDER=development`), requests return an explicit HTTP 503 (`PROVIDER_NOT_CONFIGURED`) error rather than generating fake or hallucinated translations.
   - Same-language optimization (`sourceLanguage === targetLanguage`) uses an identity provider shortcut to immediately return original text with 0 network latency.

4. **Robust Database Caching & Invalidation**
   - Database table: `comment_translations` with `UNIQUE KEY (comment_id, target_language)` and foreign key `ON DELETE CASCADE` to `comments(id)`.
   - Hash verification: every translation record stores a SHA-256 `source_content_hash`. If a comment text changes without triggering a cache purge, hash comparison prevents returning stale translations.
   - Transactional Invalidation on Edit: when a user edits their comment (`PUT /api/comments/:commentId`), all cached translations for that comment are instantly purged.
   - Cascade on Deletion: when comments are soft-deleted or permanently purged, related translations are removed immediately.

5. **Security & Authorization**
   - Video Access Control: respects video visibility (`PUBLIC`, `UNLISTED`, `PRIVATE`). Comments on private or processing videos can only be translated by the video owner or platform administrators.
   - Safe Rendering: all translated text is rendered safely as plain text preserving line breaks via CSS `whitespace-pre-wrap break-words`. No `dangerouslySetInnerHTML` is used.
   - Rate Limiting: translation mutations are safeguarded by `translationLimiter` (20 requests per 10 minutes in production, 120 in development per IP).

---

## API Endpoints

### 1. Retrieve Supported Languages
- **Endpoint**: `GET /api/translations/languages`
- **Access**: Public
- **Response**:
```json
{
  "success": true,
  "languages": [
    { "code": "en", "name": "English", "nativeName": "English", "flag": "🇺🇸" },
    { "code": "hi", "name": "Hindi", "nativeName": "हिन्दी", "flag": "🇮🇳" },
    { "code": "mr", "name": "Marathi", "nativeName": "मराठी", "flag": "🇮🇳" },
    { "code": "ta", "name": "Tamil", "nativeName": "தமிழ்", "flag": "🇮🇳" },
    { "code": "te", "name": "Telugu", "nativeName": "తెలుగు", "flag": "🇮🇳" },
    ...
  ]
}
```

### 2. Translate Comment or Reply
- **Endpoint**: `POST /api/comments/:commentId/translate`
- **Access**: Public / Optional Auth (respects private video access)
- **Rate Limit**: 20 requests per 10 minutes per IP in production
- **Request Body**:
```json
{
  "targetLanguage": "hi",
  "sourceLanguage": "en"
}
```
- **Response**:
```json
{
  "success": true,
  "translation": {
    "commentId": 17,
    "sourceLanguage": "en",
    "targetLanguage": "hi",
    "originalContent": "Hello world!",
    "translatedContent": "नमस्ते दुनिया!",
    "cached": true,
    "provider": "libretranslate"
  }
}
```

### 3. Fetch Existing Cached Translation
- **Endpoint**: `GET /api/comments/:commentId/translation?targetLanguage=hi`
- **Access**: Public / Optional Auth
- **Response (Cache Hit)**:
```json
{
  "success": true,
  "translated": true,
  "translation": {
    "commentId": 17,
    "sourceLanguage": "en",
    "targetLanguage": "hi",
    "originalContent": "Hello world!",
    "translatedContent": "नमस्ते दुनिया!",
    "cached": true,
    "provider": "libretranslate"
  }
}
```
- **Response (Cache Miss)**:
```json
{
  "success": true,
  "translated": false
}
```

---

## Database Schema

```sql
CREATE TABLE IF NOT EXISTS comment_translations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  comment_id BIGINT UNSIGNED NOT NULL,
  target_language VARCHAR(10) NOT NULL,
  source_language VARCHAR(10) DEFAULT NULL,
  translated_content TEXT NOT NULL,
  provider VARCHAR(50) NOT NULL DEFAULT 'libretranslate',
  source_content_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_comment_translations (comment_id, target_language),
  INDEX idx_comment_translations_comment_id (comment_id),
  INDEX idx_comment_translations_target_language (target_language),
  CONSTRAINT fk_comment_translations_comment FOREIGN KEY (comment_id)
    REFERENCES comments (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## Verification & Test Results
- Automated Test Suite: `scratch/test_phase13.js`
- Test Results: **35 PASSED, 0 FAILED** (100% pass rate)
- Full regression suites (Phases 6–12) confirmed **0 regressions**.
