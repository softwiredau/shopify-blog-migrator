# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

Migrates Shopify blog articles (including Bloggle posts) from one Shopify store to another, handling:

- Large content via automatic pagination/splitting (default 240k char limit)
- Metafield preservation
- Optional CDN domain rewriting
- Published date preservation

## Commands

```bash
# Setup
npm install
cp .env.example .env  # then configure with store credentials

# Dry run (no writes, validates config)
DRY_RUN=true npm run migrate

# Full migration
npm run migrate

# Migrate specific articles only
npm run migrate -- --only 1234567890,1234567891

# Bulk migration with wildcard patterns
npm run migrate -- --pattern "2024-*"
npm run migrate -- --pattern "*Tutorial*"
```

## Architecture

**Flow:** `index.js` → `migrate.js` → `shopify.js` + `utils.js`

1. **index.js** - Entry point, CLI argument parsing (--only and --pattern flags)
2. **config.js** - Environment variable loading
3. **migrate.js** - Core migration orchestration:
   - Fetches all articles from source blog (paginated)
   - Filters by ID (--only) or title pattern (--pattern) if specified
   - For each article:
     - Gets full content + metafields
     - Rewrites domains if configured
     - Splits body_html if exceeds MAX_BODY_CHARS
     - Creates article(s) in target with `external_id` tracking
     - Copies metafields to new article(s)
4. **shopify.js** - Shopify Admin REST API wrapper with pagination support
5. **utils.js** - Content processing (splitting, domain rewrite, title generation)

**Key Implementation Details:**

- **Pagination:** Uses Link header `rel="next"` with `page_info` cursor for both articles and metafields (shopify.js)
- **HTML-aware splitting:** Splits at block-level tag boundaries to preserve valid markup; warns if no safe split point found (utils.js:5-50)
- **Rate limiting:** 500ms delay between requests (~2 req/sec) with automatic retry on 429/5xx errors using p-retry (shopify.js:16-38)
- **Article splitting:** Multi-part articles get `external_id: migrated:article:{sourceId}:part:{n}` and modified titles using TITLE_PART_SUFFIX template
- **Metafield migration:** Only copied to first part of multi-part articles to avoid duplication (migrate.js:71)
- **Error handling:** Per-article try/catch with migration summary showing succeeded/failed counts (migrate.js:94-119)
- **No deduplication:** Running migration multiple times creates duplicate articles (uses external_id for tracking but doesn't check for existing)

## Configuration

See `.env.example` for all options. Critical settings:

- `MAX_BODY_CHARS` - Article body split threshold (default 240000)
- `PRESERVE_PUBLISHED_AT` - Maintain original publish dates (default true)
- `REWRITE_DOMAIN_FROM/TO` - Optional CDN domain migration
- `DRY_RUN` - Test mode (default false)

## Testing Strategy

Since there are no automated tests, manual testing workflow:

1. Dry run to validate config
2. Test single article: `npm run migrate -- --only {small_article_id}`
3. Test large article with metafields
4. Verify in target store (content, metafields, dates, domain rewrites)
5. Test article at MAX_BODY_CHARS boundary to verify splitting
