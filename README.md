# Shopify Blog Migrator

A Node.js tool to migrate blog articles (including Bloggle posts) from one Shopify store to another, with support for large content pagination, metafield preservation, and CDN domain rewriting.

## Features

- **Automatic pagination** - Handles large articles by splitting content that exceeds Shopify's size limits
- **Metafield migration** - Preserves all article metafields including Bloggle-specific data
- **Published date preservation** - Maintains original publication timestamps
- **Domain rewriting** - Optional CDN URL migration between stores
- **Selective migration** - Migrate specific articles by ID
- **Dry-run mode** - Test migrations without making changes

## Prerequisites

- Node.js 18+
- Admin API access to both source and target Shopify stores
- Custom Apps created on both stores with `read_content` (source) and `write_content` (target) scopes

## Installation

```bash
npm install
```

## Configuration

1. **Create Custom Apps on both Shopify stores:**
   - Go to Settings → Apps and sales channels → Develop apps
   - Create a new app with Admin API access
   - Configure API scopes: `read_content` for source, `write_content` for target
   - Install the app and copy the Admin API access token

2. **Set up environment variables:**

```bash
cp .env.example .env
```

Edit `.env` with your store credentials:

```bash
# SOURCE STORE
SOURCE_SHOP=source-store.myshopify.com
SOURCE_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxxx
SOURCE_API_VERSION=2025-01

# TARGET STORE
TARGET_SHOP=target-store.myshopify.com
TARGET_TOKEN=shpat_yyyyyyyyyyyyyyyyyyyyyyyy
TARGET_API_VERSION=2025-01

# BLOG HANDLES
SOURCE_BLOG_HANDLE=blog
TARGET_BLOG_HANDLE=blog

# BEHAVIOUR
PRESERVE_PUBLISHED_AT=true
MAX_BODY_CHARS=240000
TITLE_PART_SUFFIX=" (Part {n})"
REWRITE_DOMAIN_FROM=
REWRITE_DOMAIN_TO=
DRY_RUN=false
```

## Usage

### Dry Run (Recommended First Step)

Test the migration without making any changes:

```bash
DRY_RUN=true npm run migrate
```

This will:

- Validate your credentials and configuration
- Show what articles would be migrated
- Display how content would be split (if applicable)

### Full Migration

Migrate all articles from source to target blog:

```bash
npm run migrate
```

### Migrate Specific Articles

Migrate only selected articles by ID:

```bash
npm run migrate -- --only 1234567890,1234567891
```

You can find article IDs in your Shopify admin URL when editing an article.

### Bulk Migration with Patterns

Migrate articles matching a wildcard pattern (case-insensitive):

```bash
# Migrate all articles starting with "2024-"
npm run migrate -- --pattern "2024-*"

# Migrate all articles containing "Tutorial"
npm run migrate -- --pattern "*Tutorial*"

# Migrate articles with specific prefix and suffix
npm run migrate -- --pattern "How to*Guide"

# Dry run with pattern to preview matches
DRY_RUN=true npm run migrate -- --pattern "Product*"
```

Pattern matching uses `*` as a wildcard to match any characters.

## Configuration Options

| Variable | Description | Default |
|----------|-------------|---------|
| `MAX_BODY_CHARS` | Maximum characters per article before splitting | `240000` |
| `PRESERVE_PUBLISHED_AT` | Keep original publication dates | `true` |
| `TITLE_PART_SUFFIX` | Suffix for multi-part article titles (use `{n}` for part number) | `" (Part {n})"` |
| `REWRITE_DOMAIN_FROM` | Source CDN domain to replace (optional) | `""` |
| `REWRITE_DOMAIN_TO` | Target CDN domain to replace with (optional) | `""` |
| `DRY_RUN` | Run without making changes | `false` |

## How It Works

1. Connects to source store and fetches all articles from specified blog
2. For each article:
   - Retrieves full content and metafields
   - Applies domain rewriting (if configured)
   - Splits body content if it exceeds `MAX_BODY_CHARS`
   - Creates article(s) in target blog with `external_id` tracking
   - Copies all metafields to new article(s)
3. Multi-part articles are tagged with `external_id: migrated:article:{sourceId}:part:{n}`

**Note:** Running the migration multiple times will create duplicate articles. There is no deduplication logic.

## Testing Recommendations

Before running a full migration:

1. **Test with dry run:** `DRY_RUN=true npm run migrate`
2. **Test single article:** `npm run migrate -- --only {small_article_id}`
3. **Test large article:** Migrate an article with metafields and large content
4. **Verify in target store:**
   - Check article content and formatting
   - Verify metafields were copied
   - Confirm published dates preserved
   - Validate domain rewrites (if applicable)
5. **Test boundary case:** Migrate an article near `MAX_BODY_CHARS` limit

## Troubleshooting

**"Blog handle not found" error:**

- Verify `SOURCE_BLOG_HANDLE` and `TARGET_BLOG_HANDLE` match your blog handles in Shopify
- Check blog handles in Shopify admin under Online Store → Blog posts

**"Missing config" error:**

- Ensure all required variables in `.env` are set
- Verify there are no spaces around `=` in `.env` file

**Metafield warnings:**

- Some metafield copy failures are expected (namespace conflicts, protected fields)
- These are logged as warnings but don't stop the migration

**Rate limiting:**

- Shopify Admin API has rate limits (40 requests/second)
- The tool respects these limits automatically via axios

## License

MIT
