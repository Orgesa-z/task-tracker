# Daymark

Daymark is a small task and habit tracker built with React, Express, and SQLite. It is designed as a beginner-friendly full-stack project: the frontend makes requests to a few Express routes, and SQLite saves each account and its tasks locally.

## What it can do

- Create an account and sign in
- Add, edit, complete, and delete tasks
- Add habits, due dates, notes, and a priority
- Search tasks and filter by today, upcoming, habits, or completed
- Keep each account's tasks private to that account
- Update or delete your account

## Get started

You need Node.js 24 or newer and npm installed. Node includes the small SQLite database library used by this project, so no separate database setup is needed.

1. Open this project folder in a terminal.
2. Install the packages:

   ```bash
   npm install
   ```

3. Start the app:

   ```bash
   npm run dev
   ```

4. Open the local address printed by Vite (usually `http://localhost:5173`). Create an account to begin.

The Vite development server handles the React page. It sends `/api` requests to the Express server at `http://localhost:3001`. SQLite creates `server/data/daymark.sqlite` the first time the server runs. That folder is ignored by Git so local account data stays on your computer.

## Make a production build

```bash
npm run build
npm start
```

Then open `http://localhost:3001`. The production server serves the built React app and the API from one address.

## Project map

```text
src/
  App.jsx       React screens and task interactions
  style.css     Page layout and visual styles
  main.jsx      React entry point
server/
  server.js     Express routes and SQLite setup
index.html      Main page template
vite.config.js  Local development server settings
```

## A note about passwords

Passwords are hashed before they are saved. For a public deployment, copy `.env.example` to `.env`, replace `JWT_SECRET` with a long random secret, and use HTTPS. The default secret is only suitable for local learning and development.
