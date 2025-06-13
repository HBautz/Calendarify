# Calendarify

Calendarify is a **demo** Calendly clone. The repository started with static
marketing pages and now features a more complete React frontend built with
[Vite](https://vitejs.dev/) and Tailwind CSS. The React app includes pages for
product features, pricing, authentication and a simple dashboard. All pages are
demonstration only and do not implement real scheduling functionality.
Legacy marketing pages that were replaced by React now live in the `old/` directory.
Additional static prototypes reside in the `static/` folder.
The repository's root `index.html` redirects to the built React app. Run the
build script below and then open `/index` in a browser to view the site.

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
# Serve the repository root after building and open /index to view
npm run preview   # preview the production build
```

## Repository layout

```
web/              React/Vite application
web/src/          Components and pages
web/public/       Static assets
.github/workflows Auto merge workflow
old/              Archived pages replaced by React
static/           Current static prototypes
```

All assets in this repository are for demonstration purposes only.
