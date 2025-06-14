# Calendarify

Calendarify is a **demo** Calendly clone built with plain HTML and Tailwind CSS.
All pages are static prototypes used to showcase layouts and styling; no real
scheduling functionality exists.
Each route has its own folder containing an `index.html` file so URLs stay
clean (for example `/pricing/`). The included Node server also allows you to
access paths without the trailing slash or `.html` extension.

## Running locally

Install dependencies and start the server:

```bash
npm install
npm start
```

The site will be served at `http://localhost:3000`. Navigate to `/` or any route
like `/pricing` without the `.html` extension. Since pages live inside their own
folders, you can also open the HTML files directly in a browser if preferred.

## Repository layout

```
.github/workflows/  Auto merge workflow
server.js           Simple Node server for clean URLs
package.json        Start script for the server
*/index.html        Static pages, one per folder for extensionless URLs
```

Pull requests are automatically approved and merged. The workflow resolves
conflicts by preferring the PR's version of each file so the main branch stays
up to date without manual review.

All assets in this repository are for demonstration purposes only.
