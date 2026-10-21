# pearl-roots-dental-clinic

Static website for Pearl Roots Dental Clinic (https://pearlrootsdentalclinic.com). Plain HTML/CSS/JS, no framework, no CMS, no database.

## Publishing a blog post

1. `npm install` (first time only)
2. Copy `content/blog/_template.mdx` to `content/blog/<url-slug>.mdx` and fill in the frontmatter (`title`, `date`, `description` are required). The file name becomes the URL: `braces-cost-nairobi.mdx` -> `/blog/braces-cost-nairobi/`.
3. Write the post in Markdown. In `.mdx` files you can also use `<BookCta />` and `<Callout>...</Callout>`.
4. `npm run check` compiles everything and reports errors and broken internal links without writing files. Then `npm run build` generates `blog/` and `services/` and regenerates `sitemap.xml`.
5. `npm run preview` and open http://localhost:5050/blog/ to check it.
6. Commit and upload **`blog/`, `services/` and `sitemap.xml`** together with the rest of the site.

## Service pages

Each service card on the homepage links to `/services/<slug>/`, generated from `content/services/<slug>.mdx` (frontmatter: `title`, `name`, `order`, `description`, plus the optional fields blog posts use). Teeth whitening keeps its hand-built page, `teeth-whitening.html`. Service pages automatically list any blog posts that link to them.

`blog/` and `services/` are generated output and are wiped on every build, so never edit them by hand. Set `draft: true` to keep a post unpublished (`npm run build:drafts` previews drafts locally; don't deploy that build).

## Files

- `index.html`, `style.css`, `script.js`: landing page
- `teeth-whitening.html`: hand-built whitening guide (listed on the blog index via `LEGACY_POSTS` in the build script)
- `blog.css`: styles for generated blog pages
- `cta-bar.css`: sticky mobile booking bar, shared by every page
- `scripts/build-blog.mjs`: MDX to static HTML generator (also writes `sitemap.xml`; edit `STATIC_PAGES` there)
- `scripts/serve.mjs`: local preview server
