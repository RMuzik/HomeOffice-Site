import type { APIRoute } from 'astro';

// Clean EN sitemap served at homeofficesetup.net/sitemap.xml via Vercel rewrite.
// URLs use homeofficesetup.net root (no /en/ prefix) — paths match what Vercel serves.
const BASE = 'https://homeofficesetup.net';
const NOW = new Date().toISOString().split('T')[0];

const pages = [
  { path: '/',                          priority: '1.0', changefreq: 'weekly'  },
  { path: '/best-standing-desks',       priority: '0.9', changefreq: 'weekly'  },
  { path: '/best-ergonomic-chairs',     priority: '0.9', changefreq: 'weekly'  },
  { path: '/best-monitors-home-office', priority: '0.9', changefreq: 'weekly'  },
  { path: '/best-webcams-home-office',  priority: '0.8', changefreq: 'weekly'  },
  { path: '/best-headsets-home-office', priority: '0.8', changefreq: 'weekly'  },
  { path: '/best-desk-lamps',           priority: '0.8', changefreq: 'weekly'  },
  { path: '/budget-home-office-setup',  priority: '0.9', changefreq: 'weekly'  },
  { path: '/home-office-setup',         priority: '0.9', changefreq: 'weekly'  },
  { path: '/guides',                    priority: '0.7', changefreq: 'monthly' },
  { path: '/guides/ergonomics',         priority: '0.7', changefreq: 'monthly' },
  { path: '/guides/natural-lighting',   priority: '0.7', changefreq: 'monthly' },
  { path: '/about',                     priority: '0.5', changefreq: 'monthly' },
  { path: '/privacy',                   priority: '0.3', changefreq: 'yearly'  },
];

export const GET: APIRoute = () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${pages.map(p => `  <url>
    <loc>${BASE}${p.path}</loc>
    <lastmod>${NOW}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
