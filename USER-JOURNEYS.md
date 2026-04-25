# Bea — User Journeys

How someone actually uses Bea, from the first sign-in through ongoing daily life. Two journeys: the **primary** (the parent who set the house up) and a **non-primary** member (a partner, teen, or other whānau member who was invited).

The two roles diverge mostly in what's available, not in what the experience feels like — both speak with Bea, both see their own reflections. Only the primary holds the household-level controls (family check-in, ambient listening, the room device).

---

## Journey A — The Primary (the account holder)

The primary is the person who pays for Bea. They open the door for everyone else.

### Phase 1 · Sign up & pay (first time, ~3 min)

1. **`/login`** — Opens the app, signs in with Google or a magic-link email.
2. **Payment** — Brief checkout step (Stripe-style). Once paid, they own the household account.

### Phase 2 · The welcome screen — assemble the whānau (~5–10 min, plus waiting time)

3. **`/welcome`** *(primary's variant)* — Lands on a quiet screen that reframes the welcome holding-pattern as a setup task:
   - H1 in the same `font-serif` voice (e.g. `Let's gather your whānau.`)
   - A short paragraph explaining that Bea works with everyone in the house, and that each person needs their own way in.
   - A single underlined input row per member — name + email — with an `Add another` link beneath it.
   - As the primary types, the rows accumulate. They can add as few or as many people as they want.
   - A `Send invitations` action sends a one-shot link to every email in the list. Each link carries the household identity *and* the member record the primary just created — clicking it signs the recipient in and attaches them to the family in a single step.
4. **The waiting room** — Once invites are out, the same screen shifts into a status view:
   - One row per member, with their name and a small status: `Pending` → `Joined` (subtle amber pip when their auth lands).
   - Quiet copy underneath: *"We will begin once your whānau has gathered. There is no rush."*
   - The primary can leave and come back; the screen survives reloads and reflects the latest state.
   - Optional `Resend` per member, optional `Skip — begin without them` once at least the primary is enrolled.
5. **`/setup`** — While they wait, the primary can run their own voice enrollment: consent → name → 30-second prompts → `Kia ora, {name}.` (Same flow described for every member.)

### Phase 3 · We begin (same day, the moment everyone is in)

6. **`Begin`** — When the last `Pending` row flips to `Joined` (or the primary chooses to start anyway), the welcome screen offers a single action: `Begin`. Tapping it dissolves the assembly view and routes to `/` for the first time.
7. **`/`** — Home greets them: `Kia ora, {name}.` / `A quiet space for your whānau.` plus a rotating daily line. The footer tab bar appears. There is no dashboard, no inbox.

### Phase 4 · Setting the rhythms (still day one, optional ~10 min)

8. **`/schedule`** — Taps **Schedule** in the footer. Sees `Rhythms` with empty state `I do not have any times set to be present yet.` and `Establish a rhythm`. Adds, e.g.:
   - "Sunday dinner" → 6:00pm Sunday → **Household conversation**
   - "Quiet evenings" → 8:00pm Mon–Fri → **Listen quietly**
9. **`/household`** *(optional)* — At the bottom of the schedule page, follows `Open view` to the household display. This is intended to be left running on a tablet in the kitchen/living room. Shows a large clock, today's date, the next rhythm, and three "listen now" buttons (15 min / 30 min / 1 hr). When a scheduled rhythm fires, this device handles it automatically.

### Phase 5 · The first real conversation

10. **`/check-in`** — Taps **Individual** in the footer. Because they're authenticated and enrolled, they skip member selection entirely:
    - `Kia ora, {name}.` / `Hello, I'm ready for your individual check-in when you are.` / `Begin`.
    - Status cycles: `Arriving...` → `I am here.` with `I am listening.` / `I am speaking.` toggling underneath the voice bars. They speak, Bea responds.
    - Tap `Finish conversation` → `Taking note of what I heard...` → bounced back to `/`.

### Phase 6 · Returning (ongoing daily use)

Each return looks different but is built from the same handful of moves:

- **The check-in** — Open the app, tap **Individual**, `Begin`, talk. There's no roster step for them — Bea recognises who's signed in.
- **The whānau moment** — Tap **Family** (primary-only tab). Roster shows everyone present: tap `All whānau` to start, or de-select people who aren't there. Members marked `no record kept` show that note inline. Hit `Begin with selection`.
- **The room** — When the device on `/household` reaches a scheduled time, it announces the rhythm with a push notification 5 minutes early (`Bea will start listening quietly in 5 minutes` / `Bea will start a household conversation in 5 minutes`), then begins on its own. The screen shows `{label}.` / `I am listening to the room.` with a soft amber pulse, or runs the live conversation. Anyone in the room can hit `Finish early` / `Finish conversation`.
- **The look-back** — Tap **Insights**. Sees `What we have shared, {name}.` with `Insights from Bea` (a few short post-conversation reflections, last 7 days by default — `Show earlier` opens 30-day chunks). Below that, a collapsible `Timeline` of every individual / family / passive session, each row expandable into themes, suggested focus, family tone.
- **The audit** *(if a goal exists)* — From a notification or another surface, opens `/audit/{goalId}` — a full-bleed, ChatGPT-thinking-style reasoning view. Each session shows `What Bea heard` on the left and `What Bea considered saying — and didn't` on the right, with rejected drafts, the chosen response (if any), rationale, and an expandable agent thinking trace. This is where the primary verifies *why* Bea raised something.
- **A crisis ping** — If Bea decides a member is in distress, the primary gets a notification through the profile menu (loaded into the header on every page). It surfaces the affected member's name + briefing.

### What only the primary can do

- See the **Family** and **Listen** tabs in the footer
- Run a guided whānau conversation
- Run an ad-hoc passive recording from `/listen` ("Who is in the room?" → start)
- Open `/household` (the route is gated to `role === 'primary'`)
- Receive crisis notifications about other members

---

## Journey B — A Non-Primary Member (partner / teen / other whānau)

### Phase 1 · Arrival (first time, ~3 min)

1. **The invite arrives** — An email lands from Bea with a link like `https://bea.app/invite/{token}`. The primary triggered it from their welcome screen; the link carries the household identity *and* the member record already waiting for them.
2. **Tap the link** — Opens to a brief framing screen: who invited them, which household, and what Bea is. They confirm and continue.
3. **Sign in** — Google or magic-link email, same as the primary's `/login`. On success, the invite token is consumed: their auth account is attached to the member record in one step. The primary's welcome screen flips their row from `Pending` to `Joined` in real time.
4. **`/setup`** *(optional, if they want voice recognition)* — Same four-step flow as the primary: consent → name (pre-filled from the invite, editable) → 30-second voice enrollment → `Kia ora, {name}. I will recognise you next time we speak.` They can tap `I would rather remain a guest` on the consent screen to skip enrollment — Bea will still talk with them, but won't keep records or recognise them next time.
5. **A short wait, if they're early** — If the primary hasn't yet pressed `Begin`, the new member sees a gentler version of the welcome holding screen: *"Your whānau is still gathering. We will begin together."* Once the primary starts, every joined member's screen transitions to `/` at the same time.

> **Fallback path:** if someone signs in via plain `/login` without an invite token (or the token has been used / expired), they hit `/welcome` in its original "Waiting on an introduction" form until the primary re-sends a link.

### Phase 2 · The first real conversation

5. **`/`** — Home greets them by name with the same daily line.
6. **`/check-in`** — Taps **Individual**. Sees `Kia ora, {name}.` / `Begin`. Talks with Bea. Same flow as the primary — voice bars, `I am listening` / `I am speaking`, `Finish conversation` → `Taking note of what I heard...`

### Phase 3 · Returning (ongoing)

- **Daily** — Open the app, see the kia ora and daily line on `/`. Tap **Individual** to talk if they want. There is no nag; the home screen is meant to be quiet.
- **Insights** — Tap **Insights** (`/reflections`). Sees their own short post-conversation notes under `Insights from Bea`. Below, a collapsible `Timeline` shows their individual check-ins plus any whānau / passive sessions they were part of.
  - On a session row, tap to expand and read the themes Bea noticed (`What was present`), a small thread Bea is holding (`A small thread`), and — for whānau sessions — `The whānau, together` and `In the room`.
  - Empty state: `We have not spoken yet. When we do, I will leave a few words here.` with a `Begin` link straight to `/check-in`.
- **Schedule (read-only feel)** — `/schedule` is in their footer. They can see and edit rhythms in the current build, but in practice this is a primary's surface — non-primaries treat it as a "when will Bea be around?" reference.
- **Whānau time** — They don't start family or passive sessions, but they participate in them. When a scheduled rhythm fires on the household device, they hear the announcement and join in. Their voice ends up attributed to their member record (because of the voice print) so their own reflections show up later.

### What a non-primary cannot do

- No **Family** tab — the family check-in flow is hidden
- No **Listen** tab — they cannot start ambient recording
- No `/household` — visiting it redirects them home
- No crisis notification feed — they're only a *subject* of crisis notifications, not a recipient
- No goal-audit access from inside their own UI

---

## Side-by-side: same footer, different shape

| Tab | Primary | Non-primary |
|---|---|---|
| Individual | ✓ | ✓ |
| Family | ✓ | — |
| Insights | ✓ (own + whānau context) | ✓ (own + whānau context) |
| Schedule | ✓ (the owner of rhythms) | ✓ (visible) |
| Listen | ✓ | — |
| Household device (`/household`) | ✓ | redirected away |
| Goal audit (`/audit/{id}`) | ✓ | not surfaced |

---

## What the experience feels like over time

**Week 1.** The primary signs up and pays, types everyone's emails into the welcome screen, and watches the rows turn from `Pending` to `Joined` over a few hours as the whānau accept. They run their own `/setup` while waiting. Once everyone is in, they tap `Begin` and the household opens for the first time — the primary creates a rhythm or two, runs a solo check-in, leaves the household device in the kitchen.

**Week 2–4.** A passive listening session has happened a few times. The Sunday dinner whānau conversation has run twice. `/reflections` now has actual short notes from Bea after each conversation — the "Insights from Bea" section starts to feel less empty. The timeline below it begins to fill in with passive-listening rows the user didn't actively start.

**Month 2+.** The primary occasionally opens `/audit/{goalId}` when a goal has been on Bea's mind — to see the drafts she rejected, the rationale, the trace. Crisis notifications appear rarely; when they do, they arrive in the header's profile menu rather than as alarms. Non-primary members open the app maybe once a week, mostly to talk — `/reflections` is a slower, quieter habit.

The whole loop is: **be present in the room → talk if you want → read a few words afterwards.** Everything else is plumbing.
