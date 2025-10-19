import axios from 'axios';

const headers = (token) => ({
  'X-Shopify-Access-Token': token,
  'Content-Type': 'application/json',
});

export const shopifyRest = (shop, token, apiVersion) => {
  const base = `https://${shop}/admin/api/${apiVersion}`;

  return {
    async get(path, params = {}) {
      const res = await axios.get(`${base}${path}`, { headers: headers(token), params });
      return res.data;
    },
    async post(path, body) {
      const res = await axios.post(`${base}${path}`, body, { headers: headers(token) });
      return res.data;
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
    const res = await axios.get(
      `https://${api.shop}/admin/api/${api.apiVersion}/blogs/${blogId}/articles.json`,
      { headers: headers(api.token), params: { limit: 250, page_info } }
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
  const data = await api.get(`/articles/${articleId}/metafields.json`, { limit: 250 });
  return data.metafields || [];
}

export async function createArticle(api, blogId, payload) {
  const data = await api.post(`/blogs/${blogId}/articles.json`, { article: payload });
  return data.article;
}

export async function createMetafieldForArticle(api, articleId, metafield) {
  const data = await api.post(`/articles/${articleId}/metafields.json`, { metafield });
  return data.metafield;
}
