# Calendarify

Calendarify is a **demo** Calendly clone. The project contains two sets of front-end
files:

* **Static marketing pages** – standalone HTML files in the repository root such
  as `index.html`, `product.html` and `pricing.html`. These pages use Tailwind CSS
  and include disclaimers like "This is a demo application and is not intended for
  actual use."【F:index.html†L101-L104】
* **React prototype** – a minimal single-page app located in the `web/` folder.
  It is built with [Vite](https://vitejs.dev/) and contains routes for a home
  page, login, signup and a simple dashboard.

## Running the React app

```bash
cd web
npm install       # install dependencies
npm run dev       # start Vite development server
```

Additional scripts:

```bash
npm run build     # build production files into web/dist
npm run preview   # preview the production build
```

## Repository layout

```
web/              React/Vite application
web/src/          Components and pages
web/public/       Static assets
.github/workflows Auto merge workflow
*.html            Static marketing pages
```

All assets in this repository are for demonstration purposes only.
