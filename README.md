# Technova Code Sprint: 9 Days to Build
> **Technical Skill Development Hub, SVIT Nashik**  
> *Tagline: Learn | Build | Grow*  
> Theme: SVIT Crimson Red (`#B3122B`) and Warm Cream (`#FCF9F2`), Mobile-First, Student-Friendly.

---

## 🚀 Overview
"Technova Code Sprint: 9 Days to Build" is a 9-day structured developer sprint web application built for students of **SVIT Nashik**. Students across **Web**, **App**, **Python**, and **DSA** tracks complete daily 30-60 minute micro-challenges that progress from beginner concepts to a full capstone project.

### 🔍 Bug Investigation & Root-Cause Analysis: "Accept and Begin Day 1" Consent Flow
**Root Cause Note**: The "Accept and Begin Day 1" button on the proctoring consent modal failed to respond because of a prop name discrepancy between component invocation and definition: `TaskPage.jsx` passed `onAccept={handleConsentAccept}` whereas `ProctoringConsentModal.jsx` bound its click handler to `onClick={onAcceptConsent}`, leaving `onAcceptConsent` undefined so click events terminated as a no-op without updating consent state or unblocking the UI. In addition, the modal lacked inline camera/microphone pre-flight verification, did not handle browser permission exceptions (`NotAllowedError`, `NotFoundError`, `NotReadableError`), lacked a 10-second timeout on face-detection initialization, omitted an explicit "Missing requirements" indicator when disabled, and did not account for the pre-launch countdown schedule (opening at 8:00 AM IST on 14 Oct 2026 in `Asia/Kolkata` time zone), causing students to be trapped on a non-responsive modal or locked screen without real-time unlock transitions.

---

## 🌟 Key Features

### 1. 6 Full Pages
1. **Landing Page**:
   - Institutional branding, motto (*Learn | Build | Grow*).
   - Interactive 9-Day Roadmap Timeline.
   - Comprehensive rules & scoring schedule.
   - Direct Join CTA.
2. **Register / Login**:
   - Google Sign-In (SVIT G-Suite simulation & Firebase Auth support).
   - Profile completion: Full Name, PRN (Permanent Registration Number), Academic Year (FE/SE/TE/BE), Branch/Department, and Track Selection (Web / App / Python / DSA).
3. **Dashboard**:
   - 9 interactive day cards showing live status: `Locked`, `Open` (Active), `Submitted`, `Missed` (Catch-up allowed).
   - Live metrics bar: Streak Counter (🔥 flame counter), Total Points, Sprint Rank (SVIT), Tasks Submitted.
   - Half-points catch-up banner up to Day 9.
4. **Task Page**:
   - Unlocks daily at **8:00 AM IST** with live countdown to the **11:59 PM IST** deadline.
   - Deterministic assignment of 1 of 3 task variants based on a hash of the student's `userId`.
   - Dedicated curriculum for Web/App/Python tracks and algorithmic problem-solving for the DSA track.
   - Progressive 3-hint revealer unlocked step-by-step.
   - Submission form: GitHub repository link, 2-3 line "how I solved it" explanation note, optional demo link, and mandatory Honor Code checkbox.
5. **Leaderboard**:
   - Live rankings updated with points, streak counters, and track filters.
   - Visual Top 3 podium (Champion 👑, 2nd, 3rd) and detailed search by name or PRN.
6. **Faculty Admin Command Center** (`admin@svit.ac.in`):
   - Review all submissions with commit counts and timestamps.
   - Suspicious pattern detector: Flags single late bulk commits near the 11:59 PM deadline.
   - Plagiarism / Text similarity comparator across submissions.
   - 2-Minute live viva evaluator: Mark students for viva, pass or revoke daily points upon failed viva.
   - Edit task titles, descriptions, and unlock parameters.
   - One-click CSV Export (`svit_technova_sprint_submissions.csv`).

---

## 🛡️ Academic Integrity & Anti-Cheating Architecture
- **Copy/Paste & Right-Click Shield**: Context menu and text selection disabled on task descriptions.
- **Dynamic Per-User Watermark**: Faint overlay showing `${studentName} • ${PRN} • TECHNOVA 2026` repeating across the task page.
- **Tab-Switch / Blur Logger**: Focus loss events are logged and saved with submissions as faculty hints (never automatic penalties).
- **Variant Hash Assignment**: Deterministic DJB2 hash of `userId + day` assigns Variant A, B, or C.
- **Honor Code Checkbox**: *"I wrote this myself and can explain it in a 2-minute live faculty viva."*

---

## 🏆 Scoring Rules
- **Base Points**:
  - Days 1 to 3: **10 points** per day
  - Days 4 to 6: **15 points** per day
  - Days 7 & 8: **20 points** per day
  - Day 9: **25 points** (Capstone)
- **Early Bird Bonus**: **+5 points** for submitting before 9:00 PM IST on the active day.
- **9/9 Streak Glory**: **+10 points** bonus for completing all 9 consecutive days.
- **Catch-Up Policy**: Missing a day never blocks the next. Catch up until Day 9 for **50% points**.
- **Viva Policy**: Failed viva revokes that specific day's points (flags help mentors decide who gets a viva).

---

## 📦 Tech Stack
- **Framework**: React 19 + Vite 8
- **Styling**: Tailwind CSS v4 + SVIT Crimson & Cream design system
- **Icons**: Lucide React
- **Celebration Effects**: Canvas Confetti
- **Backend & Auth**: Firebase Auth + Firestore (`firebaseConfig.js` + `firestore.rules`) with instant reactive local storage fallback for demonstration.

---

## 🛠️ Getting Started

### 1. Installation
```bash
npm install
```

### 2. Run Locally in Dev Mode
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Production Build
```bash
npm run build
```

### 4. Firebase Setup (Optional for Production Deployment)
Copy `.env.example` to `.env` and fill in your Firebase project credentials:
```env
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```
Deploy the provided security rules using the Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

