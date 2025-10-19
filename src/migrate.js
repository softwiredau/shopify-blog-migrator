import { shopifyRest, findBlogIdByHandle, listArticlesPaged, getArticle, getArticleMetafields, createArticle, createMetafieldForArticle } from './shopify.js';
import { splitBody, rewriteDomains, partTitle, externalIdFor } from './utils.js';

export default async function migrate(config, { onlyIds = [] } = {}) {
  const src = shopifyRest(config.source.shop, config.source.token, config.source.apiVersion);
  src.shop = config.source.shop; src.token = config.source.token; src.apiVersion = config.source.apiVersion;

  const tgt = shopifyRest(config.target.shop, config.target.token, config.target.apiVersion);
  tgt.shop = config.target.shop; tgt.token = config.target.token; tgt.apiVersion = config.target.apiVersion;

  const sourceBlogId = await findBlogIdByHandle(src, config.source.blogHandle);
  const targetBlogId = await findBlogIdByHandle(tgt, config.target.blogHandle);

  const articles = await listArticlesPaged(src, sourceBlogId);
  const toProcess = onlyIds.length ? articles.filter(a => onlyIds.includes(String(a.id))) : articles;

  console.log(`Found ${articles.length} articles; processing ${toProcess.length}.`);

  for (const a of toProcess) {
    console.log(`\n→ Migrating article #${a.id} \"${a.title}\"`);

    const full = await getArticle(src, sourceBlogId, a.id);
    let body = rewriteDomains(full.body_html, config.behaviour.rewriteFrom, config.behaviour.rewriteTo);
    const parts = splitBody(body, config.behaviour.maxBodyChars);
    const mfs = await getArticleMetafields(src, a.id);

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
        continue;
      }

      const created = await createArticle(tgt, targetBlogId, articlePayload);
      console.log(`Created article id=${created.id} title=\"${created.title}\"`);

      for (const mf of mfs) {
        const newMf = {
          namespace: mf.namespace,
          key: mf.key,
          type: mf.type || undefined,
          value: mf.value
        };
        try {
          await createMetafieldForArticle(tgt, created.id, newMf);
        } catch (e) {
          console.warn(`  (Metafield copy warn) ${mf.namespace}.${mf.key}: ${e.message}`);
        }
      }
    }
  }

  console.log('\n✅ Migration complete.');
}
