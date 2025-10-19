# Shopify Blog Migrator (Bloggle-friendly)

Migrates Shopify Articles (incl. Bloggle posts) from one store to another.

## Setup
1. Create Custom Apps (Admin API) on both stores; collect Admin tokens.
2. `cp .env.example .env` and fill values.
3. `npm i`
4. Dry run: `DRY_RUN=true npm run migrate`
5. Real run: `npm run migrate`
6. Migrate a subset: `npm run migrate -- --only 1234567890,1234567891`
