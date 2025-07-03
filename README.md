# Calendarify Demo Website

Calendarify is a **mock** scheduling platform inspired by Calendly. This repository only contains the static frontend: HTML files styled with Tailwind CSS and a small Node server for local development. The project showcases design layouts and interactions but **does not provide any real booking or calendar functionality**.

## Project Goals

- Demonstrate responsive page designs using Tailwind CSS
- Provide realistic looking flows such as sign up, log in, dashboard and event creation
- Keep the codebase simple with one HTML file per route for clean URLs
- Allow local exploration of the pages without any backend services

This repository is part of a portfolio and all assets are for demonstration purposes only.

## Running the Site Locally

1. Install Node.js (version 14 or later works well).
2. Install dependencies and start the local server:

```bash
npm install
npm start
```

The server from `server.js` will launch at `http://localhost:3000`. It serves the HTML files so you can visit paths like `/pricing` or `/product` without the `.html` extension. Every directory contains an `index.html` file, so you may also open them directly in your browser.

## Repository Structure

```
server.js            Small Node server enabling extensionless URLs
package.json         NPM script for starting the server
.github/workflows/   GitHub Actions workflow that auto-merges pull requests
index.html           Landing page
availability/        Availability management prototype
booking/             Scheduling page for booking events
contact/             Static contact information and disclaimer
create-event/        UI for creating a new event type
Dashboard/           Example dashboard with charts and contact list
enterprise/          Marketing page targeted at enterprise teams
get-started/         Welcome page shown after sign up
help/                Help center with FAQ-style content
individuals/         Marketing page for individual users
integrations/        Showcase of integrations with other tools
log-in/              Log in form
pricing/             Pricing tiers comparison
privacy-policy/      Fake privacy policy
product/             Detailed feature overview
resources/           Collection of guides and tutorials
sign-up/             Sign up form
solutions/           Industry specific solutions overview
teams/               Marketing page for team plans
terms/               Fake terms of service
```

All HTML pages share the same header and footer for a consistent look. They include links back to the marketing pages and end with a clear disclaimer stating that the application is a demo only.

## About the Node Server

The Node server simply resolves incoming requests to the appropriate `index.html` file. If you request `/pricing`, the server returns `pricing/index.html`. This allows clean URLs when browsing locally. There is no API layer or database included.

## Planned Hosted Backend

Calendarify will eventually connect to a hosted backend that handles user accounts, availability data and event creation. This repository focuses solely on the client-side pieces so you can preview the design. When the backend is ready, these pages will be wired up to real API endpoints to provide actual scheduling functionality.

## Automated Pull Requests

The repository contains a GitHub Actions workflow (`auto-merge.yml`) that automatically approves and merges pull requests. If conflicts occur, the workflow favors the contents from the pull request to keep the main branch up to date with minimal manual intervention.

## License and Usage

Calendarify is not a real product. Feel free to explore the code and adapt the designs for your own experiments, but remember that no actual scheduling features are implemented. The site exists solely as a design prototype.

