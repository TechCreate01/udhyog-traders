# UDHyog Traders — website

Static marketing site for UDHyog Traders, a packaging and disposable supplies
business in Vatva GIDC, Ahmedabad.

No build step and no dependencies: every page is plain HTML, CSS and JavaScript and
opens directly in a browser or any static host.

## Pages

| File | Purpose |
| --- | --- |
| `index.html` | Home: ranges, process, quality, testimonials |
| `products.html` | Product ranges, capacity table, materials, quality, catalogue downloads |
| `about.html` | Company story, leadership, facility |
| `contact.html` | Contact details and enquiry form |

Shared assets live in `css/styles.css` and `js/main.js`.

## Local preview

```bash
node -e "require('http').createServer((q,s)=>{const f=require('fs'),p=require('path').join(process.cwd(),q.url==='/'?'index.html':q.url);f.existsSync(p)&&f.statSync(p).isFile()?s.end(f.readFileSync(p)):s.end('404')}).listen(8080)"
```

Then open http://localhost:8080/.

## Catalogue PDFs

`assets/catalogue/*.pdf` are generated, not hand-made. Edit the copy in
`tools/make-catalogues.js` and rebuild:

```bash
node tools/make-catalogues.js
```

## Theme and gallery

The site opens in the dark gradient theme. The sun/moon button in the header swaps
to the light theme, and the choice is stored in `localStorage` under
`udhyog-theme`, so each page repaints before its first frame.

The home page gallery pulls photographs from `assets/gallery/`. Those files are
placeholder CC0 stock images (see `assets/gallery/CREDITS.md`) and should be
swapped for photographs of the company's own products.

## Security

The site is static, so there is no server of our own to run limits on. What is
in place is the hardening a static host can enforce, plus browser-side guards on
the enquiry form.

**Headers.** A Content-Security-Policy is declared in a `<meta>` tag on every
page, so it applies even on GitHub Pages, which cannot send custom headers. For
hosts that can, the same policy is repeated with HSTS, framing, referrer and
permissions headers in:

| Host | File |
| --- | --- |
| Netlify, Cloudflare Pages | `_headers` |
| Apache, cPanel | `.htaccess` (also forces HTTPS and hides dotfiles) |
| Vercel | `vercel.json` |

Keep those three in sync when the policy changes. Scripts are restricted to
`'self'`, which is why the theme preference is read in `js/theme-init.js` rather
than an inline `<script>`; inline `style` attributes are still used, hence
`'unsafe-inline'` in `style-src` only.

**Enquiry form.** The contact form rejects submissions that fill its hidden
honeypot field or arrive less than three seconds after the page loads, and it
allows three enquiries per ten minutes per browser. Fields are capped with
`maxlength`. These are deterrents only: a client-side limit can be bypassed and
cleared, so the real rate limit, spam filtering and validation must live in
whatever handler the form is eventually pointed at (Formspree, Web3Forms, or
the company's own endpoint).

## Before publishing

All business details are placeholders and must be replaced with real ones: address,
phone, email, GSTIN, FSSAI licence number, Udyam number, ISO certificate number,
line counts and capacities, and the customer testimonials.
