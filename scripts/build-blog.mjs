// Static blog + service page generator for pearlrootsdentalclinic.com
//
//   npm run build          -> builds published posts and service pages
//   npm run build:drafts   -> also builds posts marked `draft: true` (for local preview only)
//   npm run check          -> compiles + validates all content, writes nothing
//
// Reads content/blog/*.mdx|*.md and content/services/*.mdx|*.md, writes:
//   blog/index.html              (blog index)
//   blog/<slug>/index.html       (one page per post -> clean /blog/<slug>/ URLs)
//   services/index.html          (services index)
//   services/<slug>/index.html   (one page per service)
//   sitemap.xml                  (regenerated: static pages + blog + services)
//
// The blog/ and services/ directories are fully generated and wiped on every build. Do not hand-edit them.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import matter from 'gray-matter';
import { evaluate } from '@mdx-js/mdx';
import remarkGfm from 'remark-gfm';
import * as runtime from 'react/jsx-runtime';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COLLECTIONS = {
  blog: { contentDir: path.join(ROOT, 'content', 'blog'), outDir: path.join(ROOT, 'blog'), required: ['title', 'date', 'description'] },
  services: { contentDir: path.join(ROOT, 'content', 'services'), outDir: path.join(ROOT, 'services'), required: ['title', 'name', 'order', 'description'] },
};
const SITE = 'https://pearlrootsdentalclinic.com';
const PHONE = '+254748704333';
const PHONE_DISPLAY = '+254 748 704 333';
const WA = 'https://wa.me/254748704333';
const DEFAULT_IMAGE = '/images/preview.jpeg';
const INCLUDE_DRAFTS = process.argv.includes('--drafts');
const CHECK_ONLY = process.argv.includes('--check');

// Hand-built pages that live outside content/blog but should appear on the blog index.
const LEGACY_POSTS = [
  {
    title: 'Teeth Whitening: The Complete Guide to a Brighter Smile',
    description:
      'In-office laser whitening vs. custom take-home kits, pricing, timelines and enamel safety, explained by our Ngong dentists.',
    date: '2026-09-16',
    url: '/teeth-whitening.html',
  },
];

// Non-blog pages for sitemap.xml. Bump lastmod when you change a page.
const STATIC_PAGES = [
  { loc: '/', lastmod: '2026-10-21', priority: '1.00' },
  { loc: '/teeth-whitening.html', lastmod: '2026-10-21', priority: '0.80' },
];

// Teeth whitening already has a full hand-built page, so the services index links there
// instead of generating a duplicate /services/teeth-whitening/ page.
const LEGACY_SERVICES = [
  {
    name: 'Teeth Whitening',
    order: 2,
    description: 'Professional in-clinic laser whitening and custom take-home kits, with upfront pricing.',
    url: '/teeth-whitening.html',
  },
];

/* ---------- helpers ---------- */

const esc = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const jsonLd = (obj) => JSON.stringify(obj, null, 2).replace(/</g, '\\u003c');

const waLink = (msg) => `${WA}?text=${encodeURIComponent(msg)}`;

const toIsoDate = (value, field, file) => {
  // YAML parses bare dates (2026-10-21) into Date objects; quoted dates stay strings.
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) throw new Error(`${file}: "${field}" is not a valid date (use YYYY-MM-DD)`);
  return d.toISOString().slice(0, 10);
};

const formatDate = (iso) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const absUrl = (p) => (/^https?:\/\//.test(p) ? p : SITE + p);

/* ---------- components available inside .mdx posts ---------- */

// <BookCta /> or <BookCta title="Ready for braces?" message="Hi, I'd like to ask about braces" />
function BookCta({ title = 'Book Your Free Consultation', message, children }) {
  const msg = message || 'Hi Pearl Roots, I read your blog and would like to book a free consultation. Thanks!';
  return h(
    'aside',
    { className: 'post-cta' },
    h('p', { className: 'section-label' }, 'Free Consultation'),
    h('p', { className: 'post-cta-title' }, title),
    children ? h('div', { className: 'post-cta-body' }, children) : null,
    h(
      'div',
      { className: 'post-cta-actions' },
      h('a', { className: 'btn-book', href: waLink(msg), target: '_blank', rel: 'noopener noreferrer' }, 'Book on WhatsApp'),
      h('a', { className: 'post-cta-call', href: `tel:${PHONE}` }, `Call ${PHONE_DISPLAY}`)
    )
  );
}

// <Callout>Important note</Callout>
function Callout({ children }) {
  return h('div', { className: 'post-callout' }, children);
}

const mdxComponents = {
  BookCta,
  Callout,
  // Wide markdown tables scroll sideways on phones instead of breaking the layout
  table: (props) => h('div', { className: 'table-wrap' }, h('table', props)),
};

/* ---------- shared layout ---------- */

function layout({ title, description, canonical, ogType, image, head = '', body, waMessage }) {
  const waMsg = waMessage || 'Hi Pearl Roots, I’d like to book a free consultation. Please share available slots. Thanks!';
  return `<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${esc(canonical)}" />

  <meta property="og:type" content="${ogType}" />
  <meta property="og:site_name" content="Pearl Roots Dental Clinic" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${esc(canonical)}" />
  <meta property="og:image" content="${esc(absUrl(image))}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${esc(absUrl(image))}" />

  <link rel="icon" type="image/x-icon" href="/images/favicon.ico" />
  <link rel="icon" type="image/png" href="/images/logo-96.jpeg" sizes="96x96" />
  <link rel="stylesheet" href="/blog.css" />
  <link rel="stylesheet" href="/cta-bar.css" />
${head}
</head>

<body>
  <nav class="menu">
    <div class="menu-left menu-item">
      <a href="/"><img src="/images/logo.png" alt="Pearl Roots Dental Clinic logo" class="nav-logo" /></a>
      <a href="/services/" class="menu-link nav-link desktop-only">services</a>
      <a href="/blog/" class="menu-link nav-link desktop-only">blog</a>
    </div>
    <div class="menu-center menu-item">
      <a href="/" class="brand-logo">Pearl Roots</a>
    </div>
    <div class="menu-right menu-item">
      <a href="tel:${PHONE}" class="menu-link nav-link desktop-only">call ${PHONE_DISPLAY}</a>
      <button class="burger-icon mobile-only" type="button" aria-label="Open menu" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
    </div>
  </nav>

  <div class="mobile-menu">
    <a href="/">Home</a>
    <a href="/services/">Services</a>
    <a href="/blog/">Blog</a>
    <a href="tel:${PHONE}">Call ${PHONE_DISPLAY}</a>
  </div>

  <main>
${body}
  </main>

  <footer>
    <div>
      <div class="footer-brand">Pearl Roots</div>
      <p class="footer-tagline">Gentle Care, Lasting Smiles</p>
    </div>
    <div>
      <div class="footer-col-title">Visit</div>
      <ul class="footer-links">
        <li>Ngong, Nairobi, Kenya</li>
        <li>Mon – Fri · 8am – 6pm</li>
      </ul>
    </div>
    <div>
      <div class="footer-col-title">Contact</div>
      <ul class="footer-links">
        <li><a href="tel:${PHONE}">${PHONE_DISPLAY}</a></li>
        <li><a href="${WA}" target="_blank" rel="noopener noreferrer">WhatsApp Chat</a></li>
      </ul>
    </div>
    <div class="footer-bottom">
      <span>© ${new Date().getFullYear()} Pearl Roots Dental Clinic</span>
      <span class="footer-credit">Website by <a href="https://paulobiero.me" target="_blank" rel="noopener noreferrer">OB</a></span>
      <span>Ngong, Nairobi</span>
    </div>
  </footer>

  <!-- Sticky mobile booking bar (styles in /cta-bar.css) -->
  <div class="cta-bar" role="region" aria-label="Book an appointment">
    <a class="cta-bar-book" href="${esc(waLink(waMsg))}" target="_blank" rel="noopener noreferrer">Book Free Consultation</a>
    <a class="cta-bar-wa" href="${WA}" target="_blank" rel="noopener noreferrer">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.1 5.1 0 0 0 1.1 2.7 11.7 11.7 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.7-1.2 2.2 2.2 0 0 0 .2-1.2c-.1-.1-.3-.2-.5-.3Z"/></svg>
      Chat on WhatsApp
    </a>
  </div>

  <script>
    (function () {
      var burger = document.querySelector('.burger-icon');
      var menu = document.querySelector('.mobile-menu');
      if (!burger || !menu) return;
      burger.addEventListener('click', function () {
        var open = menu.classList.toggle('show');
        burger.classList.toggle('active', open);
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    })();
  </script>
</body>

</html>
`;
}

/* ---------- build ---------- */

async function loadCollection(kind) {
  const { contentDir, required } = COLLECTIONS[kind];
  let files = [];
  try {
    files = (await fs.readdir(contentDir)).filter((f) => /\.mdx?$/.test(f) && !f.startsWith('_'));
  } catch {
    console.warn(`No ${path.relative(ROOT, contentDir)} directory found; building an empty ${kind} section.`);
  }

  const posts = [];
  const errors = [];
  for (const file of files) {
    const label = `${kind}/${file}`;
    try {
      const source = await fs.readFile(path.join(contentDir, file), 'utf8');
      const { data, content } = matter(source);

      for (const field of required) {
        if (data[field] === undefined || data[field] === '') throw new Error(`missing required frontmatter field "${field}"`);
      }
      if (data.draft && !INCLUDE_DRAFTS) {
        console.log(`  skip (draft) ${label}`);
        continue;
      }

      const slug = slugify(data.slug || file.replace(/\.mdx?$/, ''));
      const { default: Content } = await evaluate(content, {
        ...runtime,
        format: file.endsWith('.md') ? 'md' : 'mdx',
        remarkPlugins: [remarkGfm],
        baseUrl: pathToFileURL(path.join(contentDir, file)).href,
      });

      const words = content.split(/\s+/).filter(Boolean).length;
      posts.push({
        file: label,
        slug,
        url: `/${kind}/${slug}/`,
        title: String(data.title),
        name: data.name ? String(data.name) : null,
        order: Number(data.order) || 0,
        description: String(data.description),
        date: data.date ? toIsoDate(data.date, 'date', file) : null,
        updated: data.updated ? toIsoDate(data.updated, 'updated', file) : null,
        image: data.image || null,
        imageAlt: data.imageAlt || String(data.title),
        seoTitle: data.seoTitle ? String(data.seoTitle) : null,
        waMessage: data.whatsappMessage ? String(data.whatsappMessage) : null,
        words,
        readingMinutes: Math.max(1, Math.round(words / 200)),
        html: renderToStaticMarkup(h(Content, { components: mdxComponents })),
      });
    } catch (err) {
      // Collect every broken file instead of stopping at the first one
      errors.push(`${label}: ${err.message || err}`);
    }
  }

  const dupes = posts.map((p) => p.slug).filter((s, i, a) => a.indexOf(s) !== i);
  if (dupes.length) errors.push(`${kind}: duplicate slugs: ${[...new Set(dupes)].join(', ')}`);

  return {
    errors,
    items:
      kind === 'blog'
        ? posts.sort((a, b) => b.date.localeCompare(a.date))
        : posts.sort((a, b) => a.order - b.order),
  };
}

// Every root-relative link in generated HTML must point at a page that will exist.
async function findBrokenLinks(pages) {
  const known = new Set(pages.map((p) => p.url));
  const broken = [];
  for (const page of pages) {
    for (const [, href] of page.html.matchAll(/href="(\/[^"#?]*)/g)) {
      if (known.has(href)) continue;
      if (/^\/(blog|services)\//.test(href)) {
        if (href !== '/blog/' && href !== '/services/') broken.push(`${page.file}: ${href}`);
        continue;
      }
      const target = path.join(ROOT, href === '/' ? 'index.html' : href);
      try {
        await fs.access(target);
      } catch {
        broken.push(`${page.file}: ${href}`);
      }
    }
  }
  return broken;
}

function renderPost(post) {
  const canonical = `${SITE}${post.url}`;
  const image = post.image || DEFAULT_IMAGE;
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.description,
        image: absUrl(image),
        datePublished: post.date,
        dateModified: post.updated || post.date,
        mainEntityOfPage: canonical,
        author: { '@type': 'Organization', name: 'Pearl Roots Dental Clinic', url: `${SITE}/` },
        publisher: {
          '@type': 'Organization',
          name: 'Pearl Roots Dental Clinic',
          logo: { '@type': 'ImageObject', url: `${SITE}/images/logo.png` },
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE}/blog/` },
          { '@type': 'ListItem', position: 3, name: post.title, item: canonical },
        ],
      },
    ],
  };

  const body = `    <article>
      <header class="article-header">
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <a href="/">Home</a><span aria-hidden="true">/</span>
          <a href="/blog/">Blog</a><span aria-hidden="true">/</span>
          <span aria-current="page">${esc(post.title)}</span>
        </nav>
        <h1 class="article-title">${esc(post.title)}</h1>
        <p class="article-dek">${esc(post.description)}</p>
        <div class="article-meta">
          <time datetime="${post.date}">${formatDate(post.date)}</time>
          ${post.updated ? `<span>Updated <time datetime="${post.updated}">${formatDate(post.updated)}</time></span>` : ''}
          <span>${post.readingMinutes} min read</span>
          <span>Ngong, Nairobi</span>
        </div>
        ${post.image ? `<div class="featured-image-box"><img src="${esc(post.image)}" alt="${esc(post.imageAlt)}" fetchpriority="high" /></div>` : ''}
      </header>

      <div class="article-body">
        <div class="article-body-inner">
${post.html}
        </div>
      </div>
    </article>

    <section class="book-cta">
      <div class="cta-inner">
        <p class="section-label">Free Consultation</p>
        <h2 class="cta-headline">Your Smile <em>Starts Here</em></h2>
        <p>Visit our Ngong clinic for a free, no-pressure consultation. We'll examine your teeth and explain your options clearly.</p>
        <a class="btn-book" href="${esc(waLink(post.waMessage || `Hi Pearl Roots, I just read "${post.title}" and would like to book a free consultation. Thanks!`))}" target="_blank" rel="noopener noreferrer">Book on WhatsApp</a>
        <div class="book-meta">Mon – Fri · 8am – 6pm · <a href="tel:${PHONE}">Call ${PHONE_DISPLAY}</a></div>
      </div>
    </section>`;

  return layout({
    title: post.seoTitle || `${post.title} | Pearl Roots Dentist Ngong`,
    description: post.description,
    canonical,
    ogType: 'article',
    image,
    head: `  <meta property="article:published_time" content="${post.date}" />\n  <script type="application/ld+json">\n${jsonLd(schema)}\n  </script>`,
    body,
    waMessage: post.waMessage,
  });
}

function renderIndex(posts) {
  const entries = [...posts, ...LEGACY_POSTS].sort((a, b) => b.date.localeCompare(a.date));
  const cards = entries
    .map(
      (p) => `        <li class="post-card">
          <a href="${esc(p.url)}">
            <time datetime="${p.date}">${formatDate(p.date)}</time>
            <h2>${esc(p.title)}</h2>
            <p>${esc(p.description)}</p>
            <span class="post-card-more">Read article →</span>
          </a>
        </li>`
    )
    .join('\n');

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Pearl Roots Dental Clinic Blog',
    url: `${SITE}/blog/`,
    publisher: { '@type': 'Organization', name: 'Pearl Roots Dental Clinic' },
    blogPost: entries.map((p) => ({
      '@type': 'BlogPosting',
      headline: p.title,
      url: absUrl(p.url),
      datePublished: p.date,
    })),
  };

  const body = `    <header class="article-header">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="/">Home</a><span aria-hidden="true">/</span>
        <span aria-current="page">Blog</span>
      </nav>
      <h1 class="article-title">Dental <em>Advice</em></h1>
      <p class="article-dek">Straight answers on whitening, braces, implants and family dental care from our dentists in Ngong, Nairobi.</p>
    </header>

    <section class="post-list-wrap">
      <ul class="post-list">
${cards || '        <li class="post-card">New articles coming soon.</li>'}
      </ul>
    </section>`;

  return layout({
    title: 'Dental Health Blog | Dentist in Ngong, Nairobi | Pearl Roots',
    description:
      'Practical dental advice from Pearl Roots Dental Clinic in Ngong, Nairobi: teeth whitening, braces, implants and kids’ dental care. Book a free consultation.',
    canonical: `${SITE}/blog/`,
    ogType: 'website',
    image: DEFAULT_IMAGE,
    head: `  <script type="application/ld+json">\n${jsonLd(schema)}\n  </script>`,
    body,
  });
}

// `related` = blog posts that link to this service page (internal links in both directions help SEO).
function renderService(service, related) {
  const canonical = `${SITE}${service.url}`;
  const image = service.image || DEFAULT_IMAGE;
  const number = String(service.order).padStart(3, '0');
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'MedicalProcedure',
        name: service.name,
        description: service.description,
        url: canonical,
        image: absUrl(image),
        provider: {
          '@type': 'Dentist',
          name: 'Pearl Roots Dental Clinic',
          url: `${SITE}/`,
          telephone: PHONE,
          address: { '@type': 'PostalAddress', addressLocality: 'Ngong', addressCountry: 'KE' },
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Services', item: `${SITE}/services/` },
          { '@type': 'ListItem', position: 3, name: service.name, item: canonical },
        ],
      },
    ],
  };

  const relatedHtml = related.length
    ? `
    <section class="related-wrap">
      <p class="section-label">Further Reading</p>
      <ul class="post-list">
${related
  .map((p) => `        <li class="post-card"><a href="${esc(p.url)}"><h2>${esc(p.title)}</h2><p>${esc(p.description)}</p><span class="post-card-more">Read article →</span></a></li>`)
  .join('\n')}
      </ul>
    </section>`
    : '';

  const body = `    <article>
      <header class="article-header">
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <a href="/">Home</a><span aria-hidden="true">/</span>
          <a href="/services/">Services</a><span aria-hidden="true">/</span>
          <span aria-current="page">${esc(service.name)}</span>
        </nav>
        <p class="section-label">${number} — Services</p>
        <h1 class="article-title">${esc(service.title)}</h1>
        <p class="article-dek">${esc(service.description)}</p>
        <div class="article-meta">
          <span>Free consultation</span>
          <span>Mon – Fri · 8am – 6pm</span>
          <span>Ngong, Nairobi</span>
        </div>
        <div class="article-actions">
          <a class="btn-book" href="${esc(waLink(service.waMessage || `Hi Pearl Roots, I'd like to book a free consultation about ${service.name.toLowerCase()}. Thanks!`))}" target="_blank" rel="noopener noreferrer">Book Free Consultation</a>
          <a class="post-cta-call" href="tel:${PHONE}">Call ${PHONE_DISPLAY}</a>
        </div>
        ${service.image ? `<div class="featured-image-box"><img src="${esc(service.image)}" alt="${esc(service.imageAlt)}" fetchpriority="high" /></div>` : ''}
      </header>

      <div class="article-body">
        <div class="article-body-inner">
${service.html}
        </div>
      </div>
    </article>
${relatedHtml}
    <section class="book-cta">
      <div class="cta-inner">
        <p class="section-label">Free Consultation</p>
        <h2 class="cta-headline">Premium Care, <em>Fair Prices</em></h2>
        <p>Book a free, no-pressure consultation at our Ngong clinic. We'll examine your teeth and explain your options and costs before any treatment begins.</p>
        <a class="btn-book" href="${esc(waLink(service.waMessage || `Hi Pearl Roots, I'd like to book a free consultation about ${service.name.toLowerCase()}. Thanks!`))}" target="_blank" rel="noopener noreferrer">Book on WhatsApp</a>
        <div class="book-meta">Mon – Fri · 8am – 6pm · <a href="tel:${PHONE}">Call ${PHONE_DISPLAY}</a></div>
      </div>
    </section>`;

  return layout({
    title: service.seoTitle || `${service.name} in Ngong, Nairobi | Pearl Roots Dental`,
    description: service.description,
    canonical,
    ogType: 'website',
    image,
    head: `  <script type="application/ld+json">\n${jsonLd(schema)}\n  </script>`,
    body,
    waMessage: service.waMessage,
  });
}

function renderServicesIndex(services) {
  const entries = [...services, ...LEGACY_SERVICES].sort((a, b) => a.order - b.order);
  const cards = entries
    .map(
      (s) => `        <li class="post-card">
          <a href="${esc(s.url)}">
            <span class="post-card-num">${String(s.order).padStart(2, '0')}</span>
            <h2>${esc(s.name)}</h2>
            <p>${esc(s.description)}</p>
            <span class="post-card-more">View treatment →</span>
          </a>
        </li>`
    )
    .join('\n');

  const body = `    <header class="article-header">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="/">Home</a><span aria-hidden="true">/</span>
        <span aria-current="page">Services</span>
      </nav>
      <h1 class="article-title">Our <em>Services</em></h1>
      <p class="article-dek">Premium dental care at an affordable price, from routine check-ups to complete smile makeovers, at our clinic in Ngong, Nairobi.</p>
    </header>

    <section class="post-list-wrap">
      <ul class="post-list">
${cards}
      </ul>
    </section>`;

  return layout({
    title: 'Dental Services in Ngong, Nairobi | Pearl Roots Dental Clinic',
    description:
      'Affordable, premium dental care in Ngong: cosmetic dentistry, whitening, braces, implants, fillings, extractions and kids’ dentistry. Book a free consultation.',
    canonical: `${SITE}/services/`,
    ogType: 'website',
    image: DEFAULT_IMAGE,
    body,
  });
}

function renderSitemap(posts, services) {
  const today = new Date().toISOString().slice(0, 10);
  const newest = posts[0]?.updated || posts[0]?.date || today;
  const urls = [
    ...STATIC_PAGES,
    { loc: '/services/', lastmod: today, priority: '0.90' },
    ...services.map((s) => ({ loc: s.url, lastmod: s.updated || today, priority: '0.80' })),
    { loc: '/blog/', lastmod: newest, priority: '0.70' },
    ...posts.map((p) => ({ loc: p.url, lastmod: p.updated || p.date, priority: '0.60' })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated by scripts/build-blog.mjs. Edit STATIC_PAGES there, not this file. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((u) => `  <url>\n    <loc>${SITE}${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <priority>${u.priority}</priority>\n  </url>`)
  .join('\n')}
</urlset>
`;
}

async function writePage(dir, html) {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'index.html'), html);
}

async function main() {
  const blog = await loadCollection('blog');
  const services = await loadCollection('services');
  const posts = blog.items;
  const errors = [...blog.errors, ...services.errors];
  errors.push(...(await findBrokenLinks([...posts, ...services.items])).map((l) => `broken link ${l}`));

  if (errors.length) {
    console.error(`\n${errors.length} problem(s):\n  - ${errors.join('\n  - ')}`);
    process.exit(1);
  }

  if (CHECK_ONLY) {
    for (const p of [...posts, ...services.items]) console.log(`  ok ${p.file}  (${p.words} words)`);
    console.log(`Check passed: ${posts.length} post(s), ${services.items.length} service page(s). Nothing written.`);
    return;
  }

  for (const { outDir } of Object.values(COLLECTIONS)) {
    await fs.rm(outDir, { recursive: true, force: true });
    await fs.mkdir(outDir, { recursive: true });
  }

  for (const post of posts) {
    await writePage(path.join(COLLECTIONS.blog.outDir, post.slug), renderPost(post));
    console.log(`  built ${post.url}  (${post.file})`);
  }
  for (const service of services.items) {
    const related = posts.filter((p) => p.html.includes(`href="${service.url}"`)).slice(0, 4);
    await writePage(path.join(COLLECTIONS.services.outDir, service.slug), renderService(service, related));
    console.log(`  built ${service.url}  (${service.file}, ${related.length} related post(s))`);
  }

  await fs.writeFile(path.join(COLLECTIONS.blog.outDir, 'index.html'), renderIndex(posts));
  await fs.writeFile(path.join(COLLECTIONS.services.outDir, 'index.html'), renderServicesIndex(services.items));
  await fs.writeFile(path.join(ROOT, 'sitemap.xml'), renderSitemap(posts, services.items));
  console.log(
    `Done: ${posts.length} post(s), ${services.items.length} service page(s), indexes, sitemap.xml` +
      (INCLUDE_DRAFTS ? ' (DRAFTS INCLUDED - do not deploy)' : '')
  );
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
