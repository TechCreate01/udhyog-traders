# UDHyog Traders — website

Static marketing site for UDHyog Traders, an industrial manufacturing and trading
business in Vatva GIDC, Ahmedabad.

No build step and no dependencies: every page is plain HTML, CSS and JavaScript and
opens directly in a browser or any static host.

## Pages

| File | Purpose |
| --- | --- |
| `index.html` | Home: capabilities, process, quality, testimonials |
| `products.html` | Production lines, capacity table, materials, quality, catalogue downloads |
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

## Before publishing

All business details are placeholders and must be replaced with real ones: address,
phone, email, GSTIN, Udyam number, ISO certificate number, machine counts and
capacities, and the customer testimonials.
