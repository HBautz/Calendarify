# Calendarify

Calendarify is a **demo** Calendly clone. The project began with static
marketing pages and now features a React frontend built with
[Vite](https://vitejs.dev/) and Tailwind CSS. The React app reuses the exact
markup from those original pages so the design matches the legacy site
pixel-for-pixel. All pages are demonstration only and do not implement real
scheduling functionality.
Legacy marketing pages that were replaced by React now live in the `old/` directory.
Additional static prototypes reside in the `static/` folder.
Built production files live in `web/dist` so visiting `/index` immediately
launches the React app. For clean URLs such as `/pricing` or `/product`, run the
included Node server which falls back to `index.html` for unknown routes.

## Running the React app

```bash
cd web
npm install       # install dependencies
npm run dev       # start the Vite development server
# visit http://localhost:5173 to view the app during development
```

Additional scripts:

```bash
npm run build     # build production files into web/dist
# start a simple Node server for pretty URLs
cd .. && npm start
npm run preview   # preview the production build
```

## Repository layout

```
web/              React/Vite application
web/src/          Components and pages
web/public/       Static assets
.github/workflows Auto merge workflow
server.js         Simple Node server for clean URLs
package.json      Root scripts including `npm start`
old/              Archived pages replaced by React
static/           Current static prototypes
```

Pull requests are automatically approved and merged. The workflow resolves
conflicts by preferring the PR's version of each file so the main branch stays
up to date without manual review.

All assets in this repository are for demonstration purposes only.
