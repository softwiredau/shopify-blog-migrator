import axios from 'axios';
import pRetry from 'p-retry';
import pLimit from 'p-limit';

const headers = (token) => ({
  'X-Shopify-Access-Token': token,
  'Content-Type': 'application/json',
});

// Rate limiter: Shopify Admin API allows 2 requests/second (40 requests/20 seconds)
// Use pLimit(1) to serialize requests, combined with 500ms delay = strict 2 req/sec
const rateLimiter = pLimit(1);

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function retryableRequest(fn, operation = 'Request') {
  return pRetry(
    async () => {
      await delay(500); // 500ms between requests = ~2 req/sec max
      return await fn();
    },
    {
      retries: 5,
      onFailedAttempt: error => {
        if (error.response?.status === 429) {
          const retryAfter = parseInt(error.response.headers['retry-after'] || '2', 10);
          console.warn(`⚠️  Rate limited. Retrying ${operation} after ${retryAfter}s... (attempt ${error.attemptNumber}/${error.retriesLeft + error.attemptNumber})`);
          return delay(retryAfter * 1000);
        }
        if (error.response?.status >= 500) {
          console.warn(`⚠️  Server error (${error.response.status}). Retrying ${operation}... (attempt ${error.attemptNumber}/${error.retriesLeft + error.attemptNumber})`);
          return;
        }
        throw error; // Don't retry client errors (4xx except 429)
      }
    }
  );
}

export const shopifyRest = (shop, token, apiVersion) => {
  const base = `https://${shop}/admin/api/${apiVersion}`;

  return {
    async get(path, params = {}) {
      return rateLimiter(() =>
        retryableRequest(
          async () => {
            const res = await axios.get(`${base}${path}`, { headers: headers(token), params });
            return res.data;
          },
          `GET ${path}`
        )
      );
    },
    async post(path, body) {
      return rateLimiter(() =>
        retryableRequest(
          async () => {
            const res = await axios.post(`${base}${path}`, body, { headers: headers(token) });
            return res.data;
          },
          `POST ${path}`
        )
      );
    }
  };
};

export async function findBlogIdByHandle(api, handle) {
  const data = await api.get('/blogs.json', { limit: 250 });
  const blog = (data.blogs || []).find(b => b.handle === handle);
  if (!blog) throw new Error(`Blog handle not found: ${handle}`);
  return blog.id;
}

export async function listArticlesPaged(api, blogId) {
  const all = [];
  let page_info;
  do {
    const res = await rateLimiter(() =>
      retryableRequest(
        async () => {
          const response = await axios.get(
            `https://${api.shop}/admin/api/${api.apiVersion}/blogs/${blogId}/articles.json`,
            { headers: headers(api.token), params: { limit: 250, page_info } }
          );
          return response;
        },
        `GET /blogs/${blogId}/articles.json`
      )
    );
    const items = res.data.articles || [];
    all.push(...items);
    const link = res.headers.link || '';
    const m = /<([^>]+)>; rel="next"/.exec(link);
    page_info = m ? new URL(m[1]).searchParams.get('page_info') : undefined;
  } while (page_info);
  return all;
}

export async function getArticle(api, blogId, articleId) {
  const data = await api.get(`/blogs/${blogId}/articles/${articleId}.json`);
  return data.article;
}

export async function getArticleMetafields(api, articleId) {
  const all = [];
  let page_info;
  do {
    const res = await rateLimiter(() =>
      retryableRequest(
        async () => {
          const response = await axios.get(
            `https://${api.shop}/admin/api/${api.apiVersion}/articles/${articleId}/metafields.json`,
            { headers: headers(api.token), params: { limit: 250, page_info } }
          );
          return response;
        },
        `GET /articles/${articleId}/metafields.json`
      )
    );
    const items = res.data.metafields || [];
    all.push(...items);
    const link = res.headers.link || '';
    const m = /<([^>]+)>; rel="next"/.exec(link);
    page_info = m ? new URL(m[1]).searchParams.get('page_info') : undefined;
  } while (page_info);
  return all;
}

export async function createArticle(api, blogId, payload) {
  const data = await api.post(`/blogs/${blogId}/articles.json`, { article: payload });
  return data.article;
}

export async function createMetafieldForArticle(api, articleId, metafield) {
  const data = await api.post(`/articles/${articleId}/metafields.json`, { metafield });
  return data.metafield;
}
