# Calendarify

Calendarify is a **demo** Calendly clone built with plain HTML and Tailwind CSS.
All pages are static prototypes used to showcase layouts and styling; no real
scheduling functionality exists.
The included Node server lets you visit routes such as `/pricing` or `/product`
without the `.html` extension.

## Running locally

Install dependencies and start the server:

```bash
npm install
npm start
```

The site will be served at `http://localhost:3000`. Navigate to `/index` or
any page such as `/pricing` without the `.html` extension.

## Repository layout

```
.github/workflows/  Auto merge workflow
server.js           Simple Node server for clean URLs
package.json        Start script for the server
*.html              Static site pages
static/             Additional prototypes
```

Pull requests are automatically approved and merged. The workflow resolves
conflicts by preferring the PR's version of each file so the main branch stays
up to date without manual review.

All assets in this repository are for demonstration purposes only.
