import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://homeofficesetup.net',
  integrations: [
    tailwind(),
    sitemap({
      // Exclure les pages utilitaires du sitemap
      filter: (page) => !page.includes('/affiliate-disclosure') && !page.includes('/sitemap'),
      // Priorités SEO par type de page
      customPages: [],
      serialize(item) {
        // Pages best-of = priorité haute, mises à jour hebdo
        if (item.url.includes('/best-') || item.url.includes('/budget-') || item.url.includes('/home-office-')) {
          return { ...item, priority: 0.9, changefreq: 'weekly' };
        }
        // Homepage = priorité max
        if (item.url === 'https://homeofficesetup.net/') {
          return { ...item, priority: 1.0, changefreq: 'weekly' };
        }
        // Guides = priorité moyenne
        return { ...item, priority: 0.7, changefreq: 'monthly' };
      },
    }),
  ],
  output: 'static',
});
