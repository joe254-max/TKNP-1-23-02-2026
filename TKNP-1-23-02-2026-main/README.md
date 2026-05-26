<div align="center">

<img src="public/tknp-logo.png" alt="TKNP Logo" width="100" />

# The Kitale National Polytechnic
## E-Learning Platform

**A full-stack institutional e-learning system for The Kitale National Polytechnic, Kenya.**  
Built with React 19 · TypeScript · Vite · Firebase · Supabase · Gemini AI

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Firebase](https://img.shields.io/badge/Firebase-10-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Deployed on Vercel](https://img.shields.io/badge/Deployed-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Setup](#environment-setup)
  - [Running Locally](#running-locally)
  - [Running the Signaling Server](#running-the-signaling-server)
  - [Running the Mess Sub-App](#running-the-mess-sub-app)
- [Deployment](#deployment)
- [User Roles](#user-roles)
- [Modules](#modules)
- [Database Schema](#database-schema)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

The TKNP E-Learning Platform is a comprehensive digital campus system designed for **The Kitale National Polytechnic** in Kitale, Kenya. It serves students, lecturers, librarians, and administrators with a unified interface for managing academic resources, attending live classes, collaborating socially, and ordering from the campus cafeteria.

The platform was built to bridge the gap between physical and online learning at TKNP, with features ranging from a searchable digital library and real-time WebRTC video classes to an AI-powered research assistant and a campus social network.

---

## Features

### 🎓 For Students
- Browse and search the institutional e-library by department, resource type, or keyword
- Attend live video classes streamed by lecturers in real time (WebRTC)
- Join the Classnet campus social network — post updates, follow stories, join groups, attend events
- Access recorded past class sessions from the library
- Build and manage a personal academic profile
- Order food from the campus cafeteria (Mess) with M-Pesa integration

### 👨‍🏫 For Lecturers
- Manage physical and online class rosters and timetables
- Start live video broadcasts to enrolled students
- Upload lecture notes, lab manuals, and past exam papers
- Generate PDF class registers with one click
- Record live sessions and save them to the recordings library
- Use AI-powered smart search and text-to-speech for resources

### 📚 For Librarians
- Review and approve resource submissions from lecturers
- Manage the institutional resource catalogue
- Monitor download statistics and usage analytics

### 🛡️ For Admins
- Full dashboard visibility across all departments
- System alerts and user management
- Analytics and reporting

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   React Frontend (Vite)                 │
│                                                         │
│  Login → Dashboard → E-Library → StudentClasses        │
│        → Classnet  → Profile  → Recordings → Mess      │
└────────┬────────────────────┬────────────────┬──────────┘
         │                    │                │
         ▼                    ▼                ▼
   ┌──────────┐        ┌──────────┐     ┌──────────────┐
   │ Firebase │        │ Supabase │     │  Gemini API  │
   │          │        │          │     │              │
   │ • Auth   │        │ • Live   │     │ • Resource   │
   │ • WebRTC │        │   sessions│    │   recommendations│
   │   signals│        │ • Chat   │     │ • Grounded   │
   │ (Firestore)       │ • Stories│     │   research   │
   └──────────┘        │ • Profiles│    │ • Text-to-   │
                       └──────────┘     │   speech     │
                                        └──────────────┘
         │
         ▼
   ┌──────────────────┐        ┌────────────────────┐
   │ Signaling Server │        │   Mess Sub-App     │
   │ (Socket.io /     │        │ (Express + React + │
   │  Node.js)        │        │  Firebase +        │
   │ WebRTC relay     │        │  M-Pesa Daraja)    │
   └──────────────────┘        └────────────────────┘
```

**Data storage breakdown:**

| Data | Storage |
|------|---------|
| User accounts & passwords | Browser `localStorage` (hashed) |
| Google Auth users | Firebase Authentication |
| WebRTC signaling messages | Firebase Firestore (auto-expires) |
| Classnet live sessions & chat | Supabase (Postgres + Realtime) |
| Classnet stories media | Supabase Storage |
| Class recordings (blobs) | Browser IndexedDB |
| Staff class rosters & timetables | Browser `localStorage` |
| Student profiles | Browser `localStorage` |

---

## Project Structure

```
TKNP-1-23-02-2026/
│
├── App.tsx                        # Root app component — routing & auth state
├── index.tsx                      # React entry point
├── index.html                     # HTML shell with Tailwind CDN & importmap
├── types.ts                       # Shared TypeScript types & enums
├── constants.ts                   # Department list & mock resource data
├── database.ts                    # localStorage user database (PBKDF2 hashed)
├── geminiService.ts               # Gemini AI: recommendations, research, TTS
├── vite.config.ts                 # Vite build config
├── tsconfig.json                  # TypeScript config
├── package.json                   # NPM dependencies
├── .env.local.example             # Environment variable template ← copy this
│
├── components/
│   ├── Login.tsx                  # Auth: login, register, forgot password
│   ├── Navbar.tsx                 # Top navigation bar
│   ├── Sidebar.tsx                # Left navigation sidebar
│   ├── Hero.tsx                   # Home page hero / feature carousel
│   ├── Dashboard.tsx              # Staff/admin dashboard with live broadcast
│   ├── StudentClasses.tsx         # Student class list + live WebRTC receiver
│   ├── ResourceCard.tsx           # Individual library resource card
│   ├── ResourceGrid.tsx           # Filterable resource grid
│   ├── Profile.tsx                # Student profile editor
│   ├── RecordedClassesLibrary.tsx # Recorded session playback library
│   └── Classnet.tsx               # Campus social network (Bondify + Live Hub)
│
├── lib/
│   ├── firebaseClient.ts          # Firebase Auth + Firestore signaling client
│   ├── supabaseClient.ts          # Supabase client initialisation
│   ├── profile.ts                 # Profile read/write helpers
│   └── recordingsDb.ts            # IndexedDB wrapper for class recordings
│
├── public/
│   ├── tknp-logo.png
│   ├── bondify.png
│   ├── mess.png
│   ├── myclasslogo.jpg
│   ├── e-library.jpg
│   └── slide-1..5.png             # Hero carousel slides
│
├── supabase/
│   └── schema.sql                 # Full Supabase database schema + RLS policies
│
├── signaling-server/              # Standalone WebRTC signaling server
│   ├── index.js                   # Socket.io signaling logic
│   ├── package.json
│   ├── Dockerfile
│   └── README.md
│
└── Mess/                          # Cafeteria ordering sub-application
    ├── server.ts                  # Express API server (M-Pesa STK Push)
    ├── src/
    │   ├── App.tsx                # Mess React frontend
    │   ├── firebase.ts            # Mess Firebase client
    │   ├── types.ts               # Menu, order, cart types
    │   └── services/api.ts        # M-Pesa API client
    ├── package.json
    └── index.html
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 19 + TypeScript | UI components and app state |
| **Build** | Vite 6 | Dev server and production bundler |
| **Styling** | Tailwind CSS (CDN) | Utility-first styling |
| **Animation** | Framer Motion | Page transitions and UI motion |
| **Icons** | Lucide React | Icon library |
| **Charts** | Recharts | Analytics and dashboard charts |
| **Auth** | Firebase Authentication | Google Sign-In |
| **Realtime DB** | Firebase Firestore | WebRTC signaling messages |
| **Backend DB** | Supabase (Postgres) | Live sessions, chat, stories, profiles |
| **Storage** | Supabase Storage | Story media uploads |
| **AI** | Google Gemini API | Resource recommendations, research, TTS |
| **WebRTC** | Browser WebRTC API | Live video/audio peer-to-peer |
| **Signaling** | Socket.io (Node.js) | WebRTC peer discovery relay |
| **PDF** | jsPDF + html2canvas | Class register PDF export |
| **Recordings** | Browser IndexedDB | Local class recording storage |
| **Payments** | M-Pesa Daraja API | Cafeteria food ordering (Mess) |
| **Deployment** | Vercel | Frontend hosting |

---

## Getting Started

### Prerequisites

Make sure you have the following installed:

- **Node.js** v18 or later — [nodejs.org](https://nodejs.org)
- **npm** v9 or later (comes with Node.js)
- A **Firebase** project — [console.firebase.google.com](https://console.firebase.google.com)
- A **Supabase** project — [supabase.com](https://supabase.com)
- A **Gemini API key** — [aistudio.google.com](https://aistudio.google.com)

---

### Environment Setup

1. Copy the environment variable template:

```bash
cp .env.local.example .env.local
```

2. Open `.env.local` and fill in your values:

```env
# ── Firebase ────────────────────────────────────────────
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123

# ── Gemini AI ───────────────────────────────────────────
VITE_GEMINI_API_KEY=AIzaSy...

# ── Supabase ────────────────────────────────────────────
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# ── Mess sub-app ────────────────────────────────────────
# Local dev: http://127.0.0.1:3000  |  Production: your deployed Mess URL
VITE_MESS_URL=http://127.0.0.1:3000

# ── WebRTC TURN server (required for real-world networks) ─
# Free credentials: https://www.metered.ca/tools/openrelay/
VITE_TURN_URL=turn:openrelay.metered.ca:80
VITE_TURN_USERNAME=openrelayproject
VITE_TURN_CREDENTIAL=openrelayproject
```

3. Set up the **Supabase database** by running the schema:
   - Open your Supabase project → SQL Editor
   - Paste and run the contents of `supabase/schema.sql`
   - This creates all tables, indexes, RLS policies, and the storage bucket

4. Enable **Firebase Authentication**:
   - Go to Firebase Console → Authentication → Sign-in methods
   - Enable **Google** as a provider
   - Add your domain to the Authorized Domains list

5. Enable **Supabase Realtime** for the classnet tables:
   - Go to Supabase Dashboard → Database → Replication
   - Enable replication for: `classnet_live_sessions`, `classnet_live_chat_messages`, `classnet_stories`

---

### Running Locally

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at **http://127.0.0.1:5173**

To build for production:

```bash
npm run build
npm run preview
```

---

### Running the Signaling Server

The WebRTC signaling server is required for live video classes. It runs separately from the main frontend.

```bash
cd signaling-server
npm install
node index.js
```

The server starts on **port 4000** by default.

**Environment variables for the signaling server:**

```env
PORT=4000
JWT_SECRET=your_shared_jwt_secret
ALLOWED_ORIGIN=http://127.0.0.1:5173
```

**Using Docker:**

```bash
cd signaling-server
docker build -t tknp-signaling-server .
docker run -p 4000:4000 \
  -e JWT_SECRET=your_secret \
  -e ALLOWED_ORIGIN=https://your-frontend.vercel.app \
  tknp-signaling-server
```

> ⚠️ **Important:** Vercel serverless functions do not support persistent WebSocket connections. For production, deploy the signaling server on a platform that supports long-lived connections: **Render**, **Railway**, **Fly.io**, **DigitalOcean App Platform**, or a container service like **Cloud Run** or **AWS ECS**.

---

### Running the Mess Sub-App

The Mess is the campus cafeteria ordering system. It is a separate Express + React app.

```bash
cd Mess
npm install

# Copy and fill in environment variables
cp .env.local.example .env.local

# Start the Mess dev server (runs on port 3000)
npm run dev
```

**Mess environment variables (`Mess/.env.local`):**

```env
GEMINI_API_KEY=your_gemini_api_key
MPESA_CONSUMER_KEY=your_key
MPESA_CONSUMER_SECRET=your_secret
MPESA_SHORTCODE=your_shortcode
MPESA_PASSKEY=your_passkey
MPESA_CALLBACK_URL=https://yourdomain.com/api/payments/callback
MPESA_ENVIRONMENT=sandbox
JWT_SECRET=your_shared_jwt_secret
```

> The Mess M-Pesa integration uses the **Safaricom Daraja API**. Use `MPESA_ENVIRONMENT=sandbox` for testing. Register for Daraja credentials at [developer.safaricom.co.ke](https://developer.safaricom.co.ke).

---

## Deployment

### Frontend (Vercel)

The main app deploys to Vercel with zero configuration:

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

Set all `VITE_*` environment variables in the **Vercel project settings** under Settings → Environment Variables. Do **not** commit `.env.local` to git.

### Signaling Server

Deploy to any WebSocket-compatible host. Example using **Railway**:

```bash
cd signaling-server
railway init
railway up
```

Set `JWT_SECRET` and `ALLOWED_ORIGIN` in Railway's environment variables dashboard. Copy the deployed URL and set `VITE_SIGNALING_SERVER_URL` in your Vercel project.

### Mess Sub-App

Deploy the Mess as a separate service on **Render** or **Railway**:

```bash
cd Mess
# Set all Mess env vars on your host
# The app listens on PORT (default 3000)
npm start
```

After deploying, update `VITE_MESS_URL` in your Vercel environment variables to point to the deployed Mess URL.

---

## User Roles

The platform supports four user roles with different access levels:

| Role | Access |
|------|--------|
| **Student** | E-library, live class viewer, student dashboard, Classnet, profile, recordings, Mess |
| **Lecturer** | Everything students have + staff dashboard, live broadcast, resource uploads, class management, PDF register export |
| **Librarian** | Everything + resource approval queue, catalogue management |
| **Admin** | Full system access, user management, system alerts |

**To create an account:**
1. Open the app and click "Register"
2. Select your role (Student or Staff/Lecturer)
3. Enter your institutional email, full name, and a password
4. Students enter their admission number; staff enter their staff ID

**Google Sign-In** is also available on the login screen and uses your institutional Google account.

---

## Modules

### 📖 E-Library
The digital library allows browsing and searching across six departments:

| Code | Department |
|------|-----------|
| EE | Electrical Engineering |
| ICT | Information Communication Technology |
| BUS | Business & Management |
| BCE | Building & Civil Engineering |
| HOSP | Hospitality & Tourism |
| AS | Applied Sciences |

Resources are categorised as: **Lecture Notes**, **Past Papers**, **Technical Manuals**, **Research Papers**, **eBooks**, and **Videos**.

Resources can be filtered by department, type, or keyword. The Gemini-powered smart search can recommend the most relevant resources for a query and even read them aloud using text-to-speech.

---

### 🎥 Live Classes (Staff Dashboard + Student Classes)
Lecturers can broadcast live video directly from the **Staff Dashboard** to all enrolled students. The system uses **WebRTC peer-to-peer** video with **Firebase Firestore** for signaling.

- Lecturers can share their camera, microphone, and screen simultaneously
- Students see both the screen share and a lecturer camera picture-in-picture
- Live sessions are automatically recorded and saved to the recordings library
- The broadcaster can see a list of connected students in real time

Students join from the **StudentClasses** view by selecting their class and clicking "Join Live".

---

### 🌐 Classnet (Bondify Campus Social)
Classnet is a full campus social network with:

- **Bondify Feed** — post text and images, react, comment, control visibility (School / Class Only)
- **Live Hub** — host and join campus-wide live sessions for classes, events, clubs, and announcements
- **Stories** — 24-hour disappearing stories with image or text, backed by Supabase Storage
- **Groups** — join department and interest groups
- **Events** — RSVP to campus events
- **Marketplace** — buy and sell textbooks, electronics, and services within campus (KES pricing)
- **Messages** — direct message threads between students
- **Study Reels** — short educational content with an engagement-ranked algorithm

---

### 🍽️ Mess (Cafeteria App)
The Mess is a fully separate ordering application for the TKNP cafeteria:

- Browse the daily menu with Kenyan food items and prices in KES
- Add items to cart with container selection (plate / takeaway)
- Pay via **M-Pesa STK Push** (Safaricom Daraja API)
- Real-time order status updates via Firebase Firestore
- Order history and receipt generation

The Mess app is embedded inside the main platform as an iframe and also runs as a standalone service.

---

### 🤖 Gemini AI Features
Three Gemini API integrations are available throughout the platform:

| Feature | Model | Where |
|---------|-------|-------|
| **Smart resource recommendations** | Gemini Flash | E-Library search |
| **Grounded academic research** | Gemini Pro + Google Search | Library resource detail |
| **Text-to-speech** | Gemini TTS | Any resource description |

---

## Database Schema

The Supabase schema (`supabase/schema.sql`) defines the following tables:

```
classnet_profiles          — User display profiles (name, headline, department, avatar)
classnet_live_sessions     — Active and scheduled live sessions
classnet_live_guest_requests — Join requests from audience members
classnet_live_guests       — Users currently on stage in a live session
classnet_live_chat_messages — Real-time chat messages per session
classnet_stories           — 24-hour stories with expiry timestamps
```

Storage bucket: `classnet-stories` — media files for story posts.

Row Level Security (RLS) is enabled on all tables. See `supabase/schema.sql` for the full policy definitions.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes and commit: `git commit -m "feat: description of change"`
4. Push to your fork: `git push origin feature/your-feature-name`
5. Open a Pull Request against the `main` branch

**Commit message conventions:**
- `feat:` — new feature
- `fix:` — bug fix
- `security:` — security improvement
- `refactor:` — code restructuring without behaviour change
- `docs:` — documentation only
- `chore:` — dependency updates, config changes

**Before submitting a PR:**
- Run `npm run build` and confirm zero TypeScript errors
- Test login, resource browsing, and live class flow manually
- Never commit `.env.local` or any file containing real API keys

---

## License

This project is licensed under the terms described in [`License.tsx`](./License.tsx).

---

<div align="center">

Built for **The Kitale National Polytechnic** · Kitale, Kenya 🇰🇪

*Empowering learners through technology*

</div>
