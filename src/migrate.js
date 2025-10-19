import { shopifyRest, findBlogIdByHandle, listArticlesPaged, getArticle, getArticleMetafields, createArticle, createMetafieldForArticle } from './shopify.js';
import { splitBody, rewriteDomains, partTitle, externalIdFor, matchesPattern } from './utils.js';

export default async function migrate(config, { onlyIds = [], pattern = null } = {}) {
  const src = shopifyRest(config.source.shop, config.source.token, config.source.apiVersion);
  src.shop = config.source.shop; src.token = config.source.token; src.apiVersion = config.source.apiVersion;

  const tgt = shopifyRest(config.target.shop, config.target.token, config.target.apiVersion);
  tgt.shop = config.target.shop; tgt.token = config.target.token; tgt.apiVersion = config.target.apiVersion;

  const sourceBlogId = await findBlogIdByHandle(src, config.source.blogHandle);
  const targetBlogId = await findBlogIdByHandle(tgt, config.target.blogHandle);

  const articles = await listArticlesPaged(src, sourceBlogId);

  let toProcess = articles;
  if (onlyIds.length) {
    toProcess = articles.filter(a => onlyIds.includes(String(a.id)));
  } else if (pattern) {
    toProcess = articles.filter(a => matchesPattern(a.title, pattern));
  }

  console.log(`Found ${articles.length} articles; processing ${toProcess.length}${pattern ? ` (pattern: "${pattern}")` : ''}.`);

  const summary = {
    total: toProcess.length,
    succeeded: 0,
    failed: 0,
    failures: []
  };

  for (const a of toProcess) {
    console.log(`\n→ Migrating article #${a.id} \"${a.title}\"`);

    try {
      const full = await getArticle(src, sourceBlogId, a.id);
      let body = rewriteDomains(full.body_html, config.behaviour.rewriteFrom, config.behaviour.rewriteTo);
      const parts = splitBody(body, config.behaviour.maxBodyChars);
      const mfs = await getArticleMetafields(src, a.id);

      if (parts.length > 1) {
        console.log(`  Split into ${parts.length} parts due to size (${body.length} chars)`);
      }

      let partIndex = 0;
      for (const partHtml of parts) {
        partIndex++;
        const isMulti = parts.length > 1;
        const articlePayload = {
          title: isMulti ? partTitle(full.title, partIndex, config.behaviour.titlePartSuffix) : full.title,
          author: full.author,
          tags: full.tags,
          summary_html: full.summary_html || undefined,
          body_html: partHtml,
          external_id: isMulti ? `${externalIdFor(full.id)}:part:${partIndex}` : externalIdFor(full.id),
          published_at: config.behaviour.preservePublishedAt ? full.published_at : undefined
        };

        if (config.behaviour.dryRun) {
          console.log(`[DRY_RUN] Would create article with title=\"${articlePayload.title}\" chars=${partHtml.length}`);
          if (isMulti && partIndex === 1 && mfs.length > 0) {
            console.log(`[DRY_RUN] Would copy ${mfs.length} metafields to first part only`);
          }
          continue;
        }

        const created = await createArticle(tgt, targetBlogId, articlePayload);
        console.log(`  Created article id=${created.id} title=\"${created.title}\"`);

        // Only copy metafields to the first part of multi-part articles
        if (!isMulti || partIndex === 1) {
          let metafieldsCopied = 0;
          for (const mf of mfs) {
            const newMf = {
              namespace: mf.namespace,
              key: mf.key,
              type: mf.type || undefined,
              value: mf.value
            };
            try {
              await createMetafieldForArticle(tgt, created.id, newMf);
              metafieldsCopied++;
            } catch (e) {
              console.warn(`    ⚠️  Metafield ${mf.namespace}.${mf.key}: ${e.message}`);
            }
          }
          if (metafieldsCopied > 0) {
            console.log(`  Copied ${metafieldsCopied}/${mfs.length} metafields`);
          }
        }
      }

      summary.succeeded++;
    } catch (error) {
      summary.failed++;
      summary.failures.push({
        id: a.id,
        title: a.title,
        error: error.message
      });
      console.error(`  ❌ Failed: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Migration Summary');
  console.log('='.repeat(60));
  console.log(`Total articles: ${summary.total}`);
  console.log(`✅ Succeeded: ${summary.succeeded}`);
  console.log(`❌ Failed: ${summary.failed}`);

  if (summary.failures.length > 0) {
    console.log('\nFailed articles:');
    summary.failures.forEach(f => {
      console.log(`  - #${f.id} "${f.title}": ${f.error}`);
    });
  }

  console.log('\n✅ Migration complete.');
}
