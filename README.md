# Calendarify

Calendarify is a sample scheduling platform built to demonstrate a full stack web application. The project contains a static marketing site served by a small Node server and a placeholder API implemented with NestJS, Prisma and PostgreSQL.

## Features

- **Static frontend**: HTML pages styled with Tailwind CSS for pages such as booking, dashboard, pricing and more.
- **Local server**: `server.js` serves the site with extensionless URLs so paths like `/pricing` resolve to `pricing/index.html`.
- **API prototype**: The `backend/` directory holds a NestJS application using Prisma to model users, event types, bookings and availability.
- **Docker setup**: `docker-compose.yml` provisions PostgreSQL, Redis and Mailpit alongside the API.
- **Testing**: Basic Jest unit and e2e tests are included for the backend.

## Requirements

- Node.js 20 or later
- Docker and Docker Compose (to start the API services)

## Getting Started

1. Install dependencies for the root project and the backend workspace:
   ```bash
   npm install
   ```
2. Launch the static site on <http://localhost:3000>:
   ```bash
   npm start
   ```
3. Start the API and supporting services (PostgreSQL, Redis, Mailpit):
   ```bash
   docker compose up
   ```
4. During backend development you can enable hot reload:
   ```bash
   npm run start:dev
   ```

Environment variables are defined in your local `.env` file. API documentation becomes available at <http://localhost:3001/docs> once the backend is running.

## Running Tests

Backend tests are executed with Jest:

```bash
npm test
```

## Google Calendar Integration

OAuth credentials are loaded from environment variables defined in your `.env` file:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

Replace these placeholders with values from your Google Cloud Console before starting the backend.

## Zoom Integration

Zoom OAuth credentials are also read from your `.env` file:

- `ZOOM_CLIENT_ID`
- `ZOOM_CLIENT_SECRET`
- `ZOOM_REDIRECT_URI`

Provide these values from your Zoom OAuth app to enable authentication. Calendarify now uses a user-level OAuth app with a redirect URI. If you previously configured a server-to-server OAuth app using an Account ID, switch to this standard OAuth flow.
The `ZOOM_REDIRECT_URI` must exactly match the Redirect URL configured in the Zoom app (no trailing slashes or spaces).

## Outlook Integration

Like Zoom, Outlook OAuth credentials are loaded from your `.env` file:

- `OUTLOOK_CLIENT_ID`
- `OUTLOOK_CLIENT_SECRET`
- `OUTLOOK_REDIRECT_URI`
- `OUTLOOK_OAUTH_TENANT`

Supply the values from your Azure application registration so users can connect their Outlook calendars. The `OUTLOOK_REDIRECT_URI` must match the redirect URI configured in Azure exactly. `OUTLOOK_OAUTH_TENANT` defaults to `https://login.microsoftonline.com/common` for work and personal accounts.

The default redirect URI used by Calendarify is:

```
http://localhost:3001/api/integrations/outlook/callback
```

Use this URI as the redirect URI when configuring your Azure application.

If Azure returns an `access_denied` error citing **silent authentication**,
Calendarify includes `prompt=consent` in the authorization URL so the user must
interactively grant access.

## Email Notifications

Email notifications can be sent using a Gmail account. Configure the following
environment variables in your local `.env` file:

- `NOTIF_GMAIL` – the Gmail address used to send notifications
- `NOTIF_GMAIL_PASSWORD` – a Google app password for the account

The backend exposes a `NotificationsService` that wraps Nodemailer and can
optionally attach calendar invites generated with the `ics` package. Inject the
service into your modules and call `sendMail()` with the recipient, subject, and
message. Include an `event` object to attach an iCalendar file similar to how
Calendly sends invitations.

## Repository Overview

```
server.js            Node server for the static site
index.html           Landing page
backend/             NestJS API (Prisma schema and modules)
booking/             Booking flow pages
create-event/        UI for creating event types
dashboard/           Example user dashboard
pricing/             Pricing information
sign-up/, log-in/    Authentication pages
...                  Additional marketing and help pages
```

## Contributing

Pull requests are automatically approved and merged using a GitHub Actions workflow located in `.github/workflows/auto-merge.yml`.

## Disclaimer

Calendarify is provided for demonstration and educational purposes only. The project does not implement real scheduling functionality.

