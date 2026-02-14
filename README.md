# Virtual Event Management Platform (Node.js + Express + MongoDB)

Backend API for creating virtual/in-person/hybrid events and allowing attendees to register. Built with Express, Mongoose, Zod validation, JWT auth, and optional email confirmations via Resend.

## Features

- User registration and login (JWT-based authentication)
- Event CRUD (create/update/delete + fetch by id)
- Event registration:
  - Adds the user to the event’s `attendees` list (idempotent)
  - Creates/updates an `EventRegistration` record (`event`, `user`, `status`, timestamps)
- View your registrations
- View attendees for an event
- Optional registration confirmation email using Resend

## Tech Stack

- Node.js (CommonJS)
- Express
- MongoDB + Mongoose
- Zod (request validation)
- JWT (`jsonwebtoken`) for auth
- Resend (email sending)

## Project Structure

- [src/app.js](src/app.js) – Express app entry
- [src/db/mongo.js](src/db/mongo.js) – MongoDB connection
- [src/routes/userRoutes.js](src/routes/userRoutes.js) – user endpoints
- [src/routes/eventRoutes.js](src/routes/eventRoutes.js) – event + registration endpoints
- [src/models/userModel.js](src/models/userModel.js)
- [src/models/eventModel.js](src/models/eventModel.js)
- [src/models/eventRegistrationModel.js](src/models/eventRegistrationModel.js)
- [src/middleware/auth.js](src/middleware/auth.js) – JWT auth middleware
- [src/zodValidation](src/zodValidation) – Zod schemas

## Prerequisites

- Node.js 18+ (recommended)
- MongoDB running locally or a MongoDB Atlas connection string

## Setup

### 1) Install dependencies

```bash
npm install
```

### 2) Create a `.env`

Create a `.env` file at the project root:

```dotenv
PORT=3000
MONGO_URI="mongodb://127.0.0.1:27017/EventManagementDB"
JWT_SECRET="replace_with_a_strong_secret"

# Optional (for email confirmations)
RESEND_API_KEY="re_xxx"
RESEND_FROM_EMAIL="Your App <onboarding@resend.dev>"
```

Notes:
- Do **not** commit `.env` to git.
- If you use your own domain in `RESEND_FROM_EMAIL`, it must be verified in Resend.

### 3) Start the server

```bash
npm run dev
```

Server runs at:
- `http://localhost:3000`

## Authentication

Most endpoints are protected by JWT.

1) Login to get a token via `POST /users/login`.
2) Send the token in requests as:

```http
Authorization: Bearer <token>
```

## Date/Time Format

Send dates as **ISO 8601 strings** (recommended):

- `2026-02-20T15:00:00.000Z`
- `2026-02-20T15:00:00Z`
- `2026-02-20T15:00:00-05:00`

Avoid ambiguous formats like `02/20/2026`.

## API Endpoints

Base URL: `http://localhost:3000`

### Users

#### Register

- `POST /users/register`

Request body:
```json
{
  "name": "Alice",
  "username": "alice123",
  "email": "alice@example.com",
  "password": "secret123"
}
```

#### Login

- `POST /users/login`

Request body:
```json
{
  "email": "alice@example.com",
  "password": "secret123"
}
```

Response:
```json
{
  "message": "Login successful",
  "token": "<jwt>"
}
```

### Events

All event routes are mounted under `/events` in [src/app.js](src/app.js).

#### Get event by id

- `GET /events/:id`
- Auth: required

#### Create event

- `POST /events/create`
- Auth: required

Example request body:
```json
{
  "title": "Weekly Product Demo",
  "description": "Live demo + Q&A",
  "mode": "virtual",
  "startAt": "2026-02-20T15:00:00.000Z",
  "endAt": "2026-02-20T16:00:00.000Z",
  "registrationDeadline": "2026-02-20T14:30:00.000Z",
  "capacity": 200,
  "tags": ["demo", "product"],
  "price": 0,
  "location": {
    "addressLine1": "",
    "city": "",
    "country": ""
  }
}
```

#### Update event

- `PUT /events/:id`
- Auth: required

#### Delete event

- `DELETE /events/:id`
- Auth: required
- Fails if the event has attendees.

### Registration

#### Register for an event

- `POST /events/:id/register`
- Auth: required
- Body: none required

Behavior:
- Adds the current user to `Event.attendees` using `$addToSet` (no duplicates)
- Upserts an `EventRegistration` document keyed by `{ event, user }`
- Enforces:
  - event `status` must be `"published"`
  - `registrationDeadline` must not be passed (if present)
  - capacity must not be exceeded unless `isUnlimitedCapacity` is `true`
- Sends a confirmation email via Resend (only if `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are set)

Example cURL:

```bash
curl -X POST "http://localhost:3000/events/<EVENT_ID>/register" \
  -H "Authorization: Bearer <JWT>"
```

#### Get my registrations

- `GET /events/my-registrations`
- Auth: required

Returns `EventRegistration` documents populated with the referenced `event`.

#### Get attendees for an event

- `GET /events/:id/attendees`
- Auth: required

Returns the event’s attendees (populated with `name` and `email`).

## Email (Resend) Troubleshooting

If you’re not receiving emails:

- Check server logs for:
  - `Registration email skipped: RESEND_API_KEY or RESEND_FROM_EMAIL not set`
  - `Resend email send error: ...`
- In Resend dashboard, check **Email Logs** for delivery errors.
- Use a valid sender:
  - For quick testing: `RESEND_FROM_EMAIL="Your App <onboarding@resend.dev>"`
  - For your domain: verify the domain in Resend first
- Check spam/junk folder.

## Known Notes / Improvements

- Registration currently requires event `status` to be `published`. Ensure your event documents are published before testing registration.
- If you want strict atomicity between updating `Event.attendees` and inserting `EventRegistration`, MongoDB transactions require running MongoDB as a replica set.

## Scripts

- `npm run dev` – runs the server with nodemon
