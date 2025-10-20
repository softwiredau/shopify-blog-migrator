import 'dotenv/config';

const env = (k, def = undefined) => process.env[k] ?? def;

// Validate and parse MAX_BODY_CHARS
function parseMaxBodyChars(value) {
  const num = Number(value);
  if (isNaN(num) || num <= 0 || !Number.isInteger(num)) {
    throw new Error(
      `Invalid MAX_BODY_CHARS: "${value}". Must be a positive integer. ` +
      `Example: MAX_BODY_CHARS=240000`
    );
  }
  return num;
}

export default {
  source: {
    shop: env('SOURCE_SHOP'),
    token: env('SOURCE_TOKEN'),
    apiVersion: env('SOURCE_API_VERSION', '2025-01'),
    blogHandle: env('SOURCE_BLOG_HANDLE', 'blog'),
  },
  target: {
    shop: env('TARGET_SHOP'),
    token: env('TARGET_TOKEN'),
    apiVersion: env('TARGET_API_VERSION', '2025-01'),
    blogHandle: env('TARGET_BLOG_HANDLE', 'blog'),
  },
  behaviour: {
    preservePublishedAt: String(env('PRESERVE_PUBLISHED_AT', 'true')).toLowerCase() === 'true',
    maxBodyChars: parseMaxBodyChars(env('MAX_BODY_CHARS', '240000')),
    titlePartSuffix: env('TITLE_PART_SUFFIX', ' (Part {n})'),
    rewriteFrom: env('REWRITE_DOMAIN_FROM', '').trim(),
    rewriteTo: env('REWRITE_DOMAIN_TO', '').trim(),
    dryRun: String(env('DRY_RUN', 'false')).toLowerCase() === 'true',
  },
};
