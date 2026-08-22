# AZ-104: Microsoft Azure Administrator Practice Bank

An interactive web-based practice quiz bank and exam preparation application designed for the **AZ-104: Microsoft Azure Administrator** certification. It combines topic/domain-level quizzes, full-length mock exams, a reference library for the five exam domains, a quota/limits cheat sheet, and Google-authenticated score tracking — all as a static site backed by Firebase.

## Features

### Quiz Engine
* **Multiple Quiz Modes:** Practice by individual **topic**, by full **domain**, or attempt a **complete mock exam** — all driven by URL parameters (`mode`, `topic`, `domain`, `exam`, `set`).
* **Dynamic Question Set Selector:** Switch between question sets (`set1`, `set2`, `set3`, ...) for the current topic/domain/exam without leaving the page.
* **Mock Exam Dropdown:** Pick a full mock exam (`e1`, `e2`, ...) directly from the landing page before starting.
* **Single & Multiple-Answer Questions:** Questions requiring more than one correct option are detected automatically and require an explicit "Submit Answer" action; single-answer questions grade on click.
* **Randomized Options:** Answer options (and the position of the correct answer) are shuffled on every load, so the correct choice isn't always in the same place.
* **Interactive Question Palette:** A sidebar grid tracks every question's status at a glance — current, unattempted, correct, or incorrect — and lets you jump to any question directly.
* **Countdown Timer:** A 100-minute exam timer runs per attempt and auto-submits the quiz when it reaches zero.
* **Detailed Explanations:** After answering, each question reveals the correct/incorrect reasoning and, where available, a link to the official Microsoft Learn documentation.
* **Submit Anytime:** Questions can be finished early via "Submit Quiz," or completed naturally by reaching the last question.

### Authentication & Score Tracking
* **Google Sign-In:** Firebase Authentication (Google provider) gates quiz access — visitors can browse the landing page, reference library, and limits page freely, but must sign in to actually attempt a quiz.
* **Score History Dashboard:** Every completed quiz is saved to Firestore and listed on the dashboard with title, score, percentage, time taken, and date — most recent first.
* **Delete Past Attempts:** Individual score records can be removed from the dashboard with a confirmation prompt.
* **User Profile Record:** On every sign-in, the user's email, display name, and last-login time are written to Firestore (`users/{uid}`), so each `uid` is traceable back to a real person directly from the Firestore console — not just the Firebase Auth console.
* **Consistent Auth UI:** Every page shares the same sign-in / sign-out control pattern — a "Sign In with Google" button that's replaced by the user's name and a "Sign Out" button once authenticated.

### Reference Library (`references/`)
* Five standalone study-guide pages, one per AZ-104 exam domain: **Identity & Governance**, **Storage**, **Compute**, **Networking**, and **Monitoring & Backup**.
* Each page is cross-linked to the others via a shared "References" navigation bar, and links out to the relevant official Microsoft Learn documentation.

### Limits & Quotas Reference (`limits.html`)
* A single-page cheat sheet of Azure service limits and quotas relevant to the exam, organized by domain, with hard-limit vs. soft-limit badges and jump links.
* Includes an "Operational Restrictions" / "Diagnostics & Troubleshooting" notes section per domain, in addition to the raw limits tables.

### Navigation
* Consistent header (title + auth controls) and a "References" quick-links bar reused across every page, including a direct link to the Limits & Quotas page.

## Directory Structure
```text
├── index.html                  # Landing page: domains, topics, full-exam & set selectors
├── dashboard.html               # Signed-in user's score history
├── quiz.html                    # Quiz-taking page (topic / domain / complete-exam modes)
├── limits.html                  # Azure limits & quotas reference
├── style.css                    # Shared application stylesheet
│
├── js/                           # All application JavaScript (ES modules)
│   ├── firebase-config.js       # Firebase app init + shared saveUserProfile() helper
│   ├── index.js                 # Landing page: topic/domain rendering, auth, exam selector
│   ├── dashboard.js             # Score history: load, render, delete
│   ├── quiz.js                  # Quiz engine: loading, grading, timer, palette, save score
│   ├── limits.js                # Auth UI wiring for limits.html
│   └── reference.js             # Auth UI wiring shared by all references/*.html pages
│
├── references/                   # Domain study-guide pages
│   ├── identity.html            # Identity & Governance
│   ├── storage.html             # Storage
│   ├── compute.html             # Compute
│   ├── networking.html          # Networking
│   └── monitoring.html          # Monitoring & Backup
│
└── data/                          # Question banks & exam structure metadata
    ├── azure_certification_structure.json   # Domain/topic list + set counts, drives the UI
    ├── topics/
    │   ├── set1/
    │   ├── set2/
    │   └── set3/
    ├── domains/
    │   ├── set1/
    │   └── set2/
    └── complete/
        ├── e1.json
        ├── e2.json
        └── e3.json
```

> **Note:** `references/*.html` load their script as `../js/reference.js` (one shared file for all five pages), and every top-level page loads its script from `js/` (e.g. `js/index.js`). `firebase-config.js` is the single source of truth for Firebase credentials — it is never duplicated elsewhere in the project.

## Pages Overview

| Page | Purpose | Requires Sign-In? |
|---|---|---|
| `index.html` | Browse domains/topics, pick a mock exam, entry point for sign-in | No (sign-in prompted when starting a quiz) |
| `quiz.html` | Take a topic, domain, or complete-exam quiz | Yes |
| `dashboard.html` | View and manage your saved score history | Yes (redirects to `index.html` if signed out) |
| `limits.html` | Browse Azure service limits/quotas by domain | No |
| `references/*.html` | Study guides for each exam domain | No |

## Firebase Data Model (Firestore)

```
users/{uid}                       → profile document
    email: string
    displayName: string
    lastLogin: timestamp

users/{uid}/scores/{autoId}       → one document per completed quiz attempt
    quizTitle: string
    score: number
    totalQuestions: number
    percentage: number
    timeTaken: string
    timestamp: timestamp
```

* The profile document (`users/{uid}`) is written by `saveUserProfile()` in `firebase-config.js`, called on every successful sign-in from `index.js`, `dashboard.js`, `quiz.js`, `limits.js`, and `reference.js`.
* Score documents are written by `quiz.js` (`finishQuiz()`) and read/deleted by `dashboard.js`.
* Because this all runs client-side, **Firestore security rules must restrict each `users/{uid}` path to that user's own `request.auth.uid`** — the app code does not enforce this on its own.

## How It Works

1. **Sign-in:** Clicking "Sign In with Google" anywhere in the app triggers a Firebase `signInWithPopup`. Once authenticated, `onAuthStateChanged` fires on every page, swaps the sign-in button for the user's name + sign-out button, and calls `saveUserProfile()`.
2. **Browsing & starting a quiz:** `index.js` fetches `data/azure_certification_structure.json` to render the domain/topic grid and populate the exam-set dropdown. Clicking a topic, domain, or "Start Exam" link navigates to `quiz.html` with the mode encoded in the URL; unauthenticated clicks are intercepted and redirected into the sign-in flow instead.
3. **Taking the quiz:** `quiz.js` loads the right question file from `data/` based on the URL parameters, shuffles each question's options, starts the countdown timer, and renders one question at a time alongside the palette sidebar.
4. **Finishing & saving:** On completion (manually or via timer expiry), the score is tallied and written to `users/{uid}/scores` in Firestore, along with a summary screen and links back to Home/Dashboard.
5. **Reviewing history:** `dashboard.js` queries `users/{uid}/scores`, ordered newest-first, and renders each attempt as a card with a delete option.

## How to Use

### For End Users
1. Open `index.html`.
2. Click **Sign In with Google** (top-right) — or just click into a topic/domain/exam, which will prompt sign-in automatically.
3. Browse the domain/topic grid, or use the **Complete Practice Exams** selector at the top to pick a full mock exam, then click **Start Exam**.
4. Answer questions using the palette to navigate; multi-answer questions need "Submit Answer" once you've selected all options.
5. Finish the quiz early via **Submit Quiz**, or continue to the last question and click **Finish Quiz** — your score is saved automatically.
6. Visit **Dashboard** any time to review past attempts or delete old ones.
7. Use the **References** bar (on any page) to jump to a domain study guide, or to the **Limits & Quotas** cheat sheet.

### For Developers / Hosting This Yourself
1. **Create a Firebase project** (Firebase Console → Add project), enable **Authentication → Google** as a sign-in provider, and enable **Firestore Database**.
2. Copy your project's config values into `js/firebase-config.js` (already wired up; just replace the `firebaseConfig` object).
3. **Set Firestore security rules** so each user can only read/write their own data, e.g.:
   ```
   match /users/{uid} {
     allow read, write: if request.auth != null && request.auth.uid == uid;
     match /scores/{scoreId} {
       allow read, write: if request.auth != null && request.auth.uid == uid;
     }
   }
   ```
4. Populate `data/azure_certification_structure.json` and the corresponding files under `data/topics/`, `data/domains/`, and `data/complete/` with your question banks.
5. Serve the project root as a static site (any static host works — Firebase Hosting, GitHub Pages, Netlify, or a local dev server) and open `index.html`.
6. In Google Cloud Console, keep the OAuth consent screen's publishing status as **Production** (or **Internal**) rather than **Testing** — Testing status causes Google to periodically force re-consent, which can be confusing for returning users.

## Tech Stack
* **Frontend:** Vanilla HTML, CSS, and JavaScript (ES modules) — no build step or framework.
* **Backend:** Firebase Authentication (Google provider) and Cloud Firestore, accessed directly from the browser via the Firebase JS SDK (v10.8.0, loaded from `gstatic.com`).
* **Data:** Static JSON question banks served from `data/`.
