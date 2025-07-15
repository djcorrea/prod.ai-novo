# Prod.AI

This project provides serverless APIs and a simple frontend for interacting with Firebase, OpenAI and Mercado Pago.

## Installation

1. Install [Node.js](https://nodejs.org/) (v18 or later recommended).
2. Install project dependencies:
   ```bash
   npm install
   ```

## Configuration

Create a `.env` file in the project root based on `.env.example` and fill in your credentials:

- `OPENAI_API_KEY` – OpenAI API token.
- `FIREBASE_SERVICE_ACCOUNT` – Firebase service account JSON (as a single line string).
- `FIREBASE_PROJECT_ID` – Firebase project ID.
- `FIREBASE_CLIENT_EMAIL` – Service account client email.
- `FIREBASE_PRIVATE_KEY` – Service account private key (newline escaped with `\n`).
- `MP_ACCESS_TOKEN` – Mercado Pago access token.
- `FRONTEND_URL` – URL of the frontend (used for payment redirects).
- `PORT` – Local port for the Express server (optional).

## Running locally

Install the Vercel CLI if you haven't yet:
```bash
npm install -g vercel
```

Start the development server:
```bash
npm run dev
```
This runs `vercel dev`, serving the API routes from `api/` and static files from `public/`.

Alternatively you can run only the chat API with:
```bash
npm start
```

