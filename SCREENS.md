# Bea — User-Facing Screens

A reference of every screen a user can land on, what it's for, where it lives, and the copy shown on it. Persistent header (`Bea` wordmark + profile menu) and footer tabs (`Individual`, `Family`*, `Insights`, `Schedule`, `Listen`*) wrap most authenticated screens. *Family/Listen tabs only appear for the primary parent.*

---

## 1. Home

- **URL:** `/`
- **File:** [src/app/home-client.tsx](bea/src/app/home-client.tsx) (authed); [src/app/page.tsx](bea/src/app/page.tsx) (unauthed splash)
- **Purpose:** Unauthenticated visitors see a quiet splash with the Bea wordmark and an "Enter" link to `/login`. Authenticated members see a quiet landing that greets them by name and orients them.
- **Text (unauthed splash):**
  - Wordmark (large): `Bea`
  - CTA: `Enter` (links to `/login`)
- **Text (authed home):**
  - H1: `Hello, {memberName}.` (or `Hello.` if anonymous)
  - Daily line (rotates): the value of `getDailyLine()` (a single sentence shown large)
  - Current goal block (only if the member has an active goal — links to `/audit/{goalId}`):
    - Label: `Your current goal`
    - Goal text: `"{goal title with leading 'I want to ' stripped}"` (Lora italic, quoted)

---

## 2. Login

- **URL:** `/login`
- **File:** [src/app/login/page.tsx](bea/src/app/login/page.tsx)
- **Purpose:** Sign in with Google or magic-link email. Three sub-states: default, email-entry, sent.
- **Text:**
  - H1: `Welcome.`
  - Subtitle: `Sign in to join your family.`
  - Google button: `Continue with Google`
  - Toggle: `Or use an email link`
  - Email input placeholder: `Your email address...`
  - Submit button: `Send link` / `Sending...`
  - "Sent" state: `I have sent a note to your email.` / `You can use the link inside it to enter when you are ready. You can close this window now.`

---

## 3. Welcome (waiting on link)

- **URL:** `/welcome`
- **File:** [src/app/welcome/page.tsx](bea/src/app/welcome/page.tsx)
- **Purpose:** Holding screen for an authenticated user who hasn't been linked to a family member yet. Auto-redirects to `/` once linked.
- **Text:**
  - H1: `Waiting on an introduction.`
  - Body: `I can see you've arrived, but I don't know which family you belong to yet.`
  - Body: `When the person who invited you makes the connection on their end, we can begin. There's no rush.`
  - Action: `Sign out` (utility button)

---

## 4. Setup (voice enrollment)

- **URL:** `/setup`
- **File:** [src/app/setup/page.tsx](bea/src/app/setup/page.tsx)
- **Purpose:** New-member onboarding flow: consent → name → 30-second voice enrollment → done. Multi-step, single page.
- **Text by step:**
  - **Consent**
    - H1: `Before we speak.`
    - `I listen to you and the people you live with. To do this, I keep a few things.`
    - `I keep a voice print so I can recognise you without you having to introduce yourself. I keep summaries of our conversations, and notice patterns in how the house feels.`
    - `You can ask me to remove you at any time. If you do, I will forget your voice, though past summaries will remain part of the house's memory.`
    - Primary: `I understand` · Secondary: `I would rather remain a guest`
  - **Name**
    - H1: `What shall I call you?`
    - Input placeholder: `Your name...`
    - Primary: `Continue`
  - **Creating:** `Taking note...`
  - **Record (intro)**
    - H1: `Let me hear your voice.`
    - `I will show you a few questions. Just answer them naturally. It takes about thirty seconds.`
    - `I just need to hear the tone of your voice, not any particular words.`
    - Primary: `Begin`
  - **Recording (rotating prompts)**
    - `Tell me your name, and what a typical day looks like for you.`
    - `What has been on your mind lately?`
    - `Describe a place you love going, or something you enjoy doing.`
    - `What is one thing that has made you smile recently?`
    - Status: `Listening... {n}s` / `Finishing up...`
  - **Enrolling:** `Learning your voice...`
  - **Done**
    - H1: `Kia ora, {name}.`
    - `I will recognise you next time we speak. You do not need to do anything—just start talking.`
    - Primary: `Talk with me now` · Secondary: `Return home`
  - **Error**
    - H1: `Something stopped us.`
    - Body: error message
    - Primary: `Try again` · Secondary: `Cancel`

---

## 5. Individual Check-In

- **URL:** `/check-in` (default — `mode != 'family'`)
- **File:** [src/app/check-in/check-in-client.tsx](bea/src/app/check-in/check-in-client.tsx)
- **Purpose:** A 1:1 voice conversation with Bea. If the user is signed in and linked, skips selection; otherwise shows a roster.
- **Text:**
  - **Authed start screen**
    - H1: `Hello, {name}.`
    - Subtitle: `I'm ready for your individual check-in when you are.`
    - Primary: `Begin`
  - **Unlinked / fallback selection**
    - H1: `Who is here?`
    - Member rows show `{name}` + role label `(Parent)` for primary; hover label: `Select`
    - Guest row: `A guest` + `(Unrecorded)`
    - Error: `I can't seem to find your family right now. Please wait a moment.`
  - **Live session**
    - Status (cycles): `Arriving...` → `I am here.` → `Taking note of what I heard...`
    - Sub-state: `I am speaking.` / `I am listening.`
    - Action: `Finish conversation` (when connected) / `Cancel` (otherwise)
    - Error: `I could not arrive. Please try again.` / `Something stopped us.`

---

## 6. Family Check-In

- **URL:** `/check-in?mode=family`
- **File:** [src/app/check-in/family-check-in.tsx](bea/src/app/check-in/family-check-in.tsx)
- **Purpose:** A guided family conversation with Bea, recorded for later transcription. Phases: roster → connecting → live → uploading → done/error.
- **Text:**
  - **Roster**
    - H1: `Hello, family.`
    - Subtitle: `A conversation for everyone in the room. Who's here?`
    - Loading: `Loading family…`
    - Empty: `No family on record yet. Add members first, then come back.`
    - Primary: `Everyone's here`
    - Helper: `Or choose who is here:`
    - Per-member row: `{name}` + status `Here` / `Not here`; non-consented note `no record kept`
    - Action: `Begin with selection`
  - **Connecting / live**
    - H1: `Arriving…` → `I am here.`
    - Sub-state: `I am speaking.` / `I am listening.`
    - Action: `Finish conversation` / `Cancel`
  - **Uploading:** `Taking note of what I heard…`
  - **Done:** `Kept safely.`
  - **Error:** `Something stopped us.` + error message + `Try again`

---

## 7. Listen (passive recording)

- **URL:** `/listen`
- **File:** [src/app/listen/listen-client.tsx](bea/src/app/listen/listen-client.tsx)
- **Purpose:** Passive ambient recording of the room — Bea listens silently, no agent voice. Same phase model as family check-in.
- **Text:**
  - **Roster**
    - H1: `Who's in the room?`
    - Subtitle: `I'll listen quietly, and notice what I can.`
    - Primary: `Everyone's here`
    - Helper: `Or choose who is here:`
    - Empty / loading copy same as family check-in
    - Actions: `Begin with selection` · `Skip`
  - **Recording**
    - H1: `I am listening.`
    - Timer: `MM:SS`
    - Action: `Finish listening`
  - **Uploading:** `Taking note of what I heard…`
  - **Done:** `Kept safely.`
  - **Error:** `Something stopped us.` + `Try again`

---

## 8. Reflections (insights timeline)

- **URL:** `/reflections`
- **File:** [src/app/reflections/timeline-client.tsx](bea/src/app/reflections/timeline-client.tsx)
- **Purpose:** Personal log — short reflections Bea wrote after each conversation, plus a collapsible full timeline of every individual / family / passive session.
- **Text:**
  - H1: `What we've shared, {memberName}.`
  - Subtitle: `A few words after each time we've spoken.`
  - Section heading: `Insights from Bea`
  - Empty: `We haven't spoken yet. When we do, I'll leave a few words here.` + `Begin` link
  - Empty (windowed): `Nothing in the last {n} days.`
  - Per-entry meta: formatted date · `After we spoken`-style: `After we spoke` italic note
  - Show-more: `Show earlier`
  - Section heading: `Timeline` + `{n} entries`
  - Subtitle: `A record of every time we've spoken, and every time I've listened.`
  - Timeline kind labels: `Individual check-in` / `Family check-in` / `Bea was listening`
  - Expanded labels: `What was present`, `A small thread`, `The family, together`, `In the room`
  - Placeholder previews: `A quiet conversation. I have not yet written about this one.` / `I sat with your family.`
  - Footer: `Back`

---

## 9. Schedule (rhythms)

- **URL:** `/schedule`
- **File:** [src/app/schedule/page.tsx](bea/src/app/schedule/page.tsx)
- **Purpose:** Configure recurring weekly times for Bea to listen, run an individual check-in, or run a household conversation.
- **Text:**
  - **List view**
    - Back link: `← Return`
    - H1: `Rhythms`
    - Loading: `Recollecting...`
    - Empty: `I don't have any times set to be present yet.` + `Establish a rhythm`
    - Per-rhythm: `{label}` / `{HH:MM} on {Mon, Tue, …}.` / mode label (`Listen quietly` / `Individual conversation` / `Household conversation`)
    - Per-rhythm actions: `Pause` ↔ `Resume`, `Remove`
    - `Add another`
    - Footer block: `If you're leaving a device in the room for me to listen, you can open the household view.` + `Open view`
  - **Form view**
    - H1: `When shall we make time?`
    - Label input placeholder: `e.g. Sunday dinner...`
    - `At what time?`
    - `On which days?` — day names Mon–Sun
    - `How should I be present?` — three modes:
      - `Listen quietly` — `I'll listen in the background without speaking.`
      - `Individual conversation` — `A dedicated moment with one person.`
      - `Household conversation` — `A moment to speak with everyone present.`
    - Primary: `Confirm` (or `Taking note...` while saving) · Secondary: `Cancel`

---

## 10. Household (ambient device view, primary only)

- **URL:** `/household`
- **File:** [src/app/household/household-client.tsx](bea/src/app/household/household-client.tsx)
- **Purpose:** Always-on display intended to be left on a device in the family room. Shows a clock, the next scheduled rhythm, and quick "listen now" buttons. Drives the scheduled passive/group sessions automatically.
- **Text:**
  - **Idle**
    - Time + date in NZ locale
    - `Hello, family. I'm ready for your check-in when you are.`
    - Next rhythm (if any): `I'll be present for {label} {in N minutes}.`
    - Else: `I don't have any rhythms scheduled today.`
    - Manual block: `Or, I can listen quietly now for:` → buttons `15 min` `30 min` `1 hr`
    - Footer: `Leave this screen open in the room.`
  - **Listening (passive)**
    - Label: `{label}.`
    - `I am listening to the room.`
    - End-time line: `We will finish at {time}`
    - Action: `Finish early`
  - **Connecting:** `Arriving...`
  - **Live conversation**
    - Label: `{label}.`
    - Sub-state: `I am speaking.` / `I am listening.`
    - Action: `Finish conversation`
  - **Ending**
    - `We are finished.`
    - `Taking note of what I heard...`
  - **Push notifications fired from this screen:**
    - `Bea will start listening quietly in 5 minutes` / `Bea will start a household conversation in 5 minutes`
    - `Bea is listening quietly` / `Bea has stopped listening` (`The room is private again.`)
    - `Bea has begun a household conversation` (`She is in the room now.`)
    - `Household conversation has ended` (`Bea is taking note of what she heard.`)

---

## 11. Goal Audit (deep-dive on a single goal)

- **URL:** `/audit/{goalId}`
- **File:** [src/app/audit/[goalId]/page.tsx](bea/src/app/audit/[goalId]/page.tsx)
- **Purpose:** Full-viewport reasoning audit for one goal — every session the Coach reasoned about, what Bea heard, what she considered saying, what was raised. Renders without app chrome.
- **Text:**
  - Eyebrow: `Audit · {memberName}'s goal · Set {long date}`
  - H1: `"{goal title with leading 'I want to ' stripped}"`
  - Stat tiles: `Sessions`, `Drafts considered`, `Raised to her`, `Patterns / observations`
  - Per session card:
    - `Session {i} / {total}`, weekday + day-month, time
    - `Passive listening` or `1:1 check-in`, optional `· {n} min`
    - Decision pill: `RAISE` / `WAIT` / `NOTE`
    - Left column heading: `What Bea heard`
      - Labels: `tone`, `family tone`, `wellbeing` (green/amber/red); themes as chips; reflection as blockquote
      - Tail line on last entry: `↑ this is where Bea surfaced live in the session`
    - Right column heading: `What Bea considered saying — and didn't`
      - Empty: `Nothing on the table this session.`
      - Per draft: `draft "{text}"` + `why not {text}`
      - If raised: `Decided to bring up next time` + `"{response}"`
      - `rationale {text}`
      - Expandable: agent thinking trace
  - Footer left: `Patterns the agents noticed` (with severity dot, confidence, supporting session count). Empty: `No patterns yet.`
  - Footer right: `Observations against the goal ({metric_key})`. Empty: `No structured observations yet.`

---

## 12. Developer Reasoning Audit (internal)

- **URL:** `/dev/reasoning?id={sessionId}&filter={filter}`
- **File:** [src/app/dev/reasoning/page.tsx](bea/src/app/dev/reasoning/page.tsx)
- **Purpose:** Three-pane developer view of the agent chain for any session — list of sessions, agent-by-agent reasoning chain, decision summary. Shipped as a transparency artifact for the research thesis, not a member-facing surface.
- **Text:**
  - Header: `BEA · DEVELOPER REASONING AUDIT` + `{n} sessions`
  - Live toggle in top-right
  - Three columns (rendered by sub-components):
    - Left: session list, filterable by `all` / `individual` / `guided` / `passive` / `family-insight` / `has-crisis` / `has-tikanga`
    - Middle: agent chain for the selected session
    - Right: decision summary
  - Footer: `This page exists because Bea's research argues that ethical AI requires visible reasoning. — Lian, Lee, Karaitiana.`

---

## Persistent chrome

### Header bar
[src/components/header-bar.tsx](bea/src/components/header-bar.tsx)
- Wordmark link `Bea` (Lora medium) → `/`
- Profile menu (right) — name, avatar, crisis notifications

### Footer tab bar
[src/components/footer-bar.tsx](bea/src/components/footer-bar.tsx)
- Tabs (icons + labels):
  - `Individual` → `/check-in?mode=individual`
  - `Family` → `/check-in?mode=family` *(primary only)*
  - `Insights` → `/reflections`
  - `Schedule` → `/schedule`
  - `Listen` → `/listen` *(primary only)*
- Hidden on full-viewport routes (`/audit/...`).
