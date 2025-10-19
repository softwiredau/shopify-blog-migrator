import { Command } from 'commander';
import config from './config.js';
import migrate from './migrate.js';

const program = new Command();
program
  .name('shopify-blog-migrator')
  .option('--only <ids>', 'Comma-separated article IDs to migrate')
  .option('--pattern <pattern>', 'Wildcard pattern to match article titles (e.g., "2024-*" or "*Tutorial*")')
  .parse(process.argv);

const opts = program.opts();
const onlyIds = opts.only ? opts.only.split(',').map(s => s.trim()) : [];
const pattern = opts.pattern || null;

(async () => {
  for (const group of ['source', 'target']) {
    const g = config[group];
    if (!g.shop || !g.token) throw new Error(`Missing config for ${group.toUpperCase()} store`);
  }
  await migrate(config, { onlyIds, pattern });
})();
