# Bea — User Journeys

How someone actually uses Bea, from the first sign-in through ongoing daily life. Two journeys: the **primary** (the parent who set the house up) and a **non-primary** member (a partner, teen, or other whānau member who was invited).

The two roles diverge mostly in what's available, not in what the experience feels like — both speak with Bea, both see their own reflections. Only the primary holds the household-level controls (family check-in, ambient listening, the room device).

---

## Journey A — The Primary (the account holder)

The primary is the person who pays for Bea. They open the door for everyone else.

> *Lian and her husband sign up because home feels disconnected — teenagers, youth, and toddlers all under one roof, and most of the day is nagging, cleaning, whinging. They want a more cohesive team. They suspect some of what frustrates them is beyond the kids' control. They want a third set of eyes — to listen, spot patterns, and help.*

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
> *No voice enrollment step exists in the seven-day build. Per-speaker recognition (Azure Speech Services) is out of scope; for now Bea works from diarized transcripts (`speaker 1`, `speaker 2`…) and a guardian skill maps each speaker back to the right member after the fact.*

### Phase 3 · We begin (same day, the moment everyone is in)

6. **`Begin`** — When the last `Pending` row flips to `Joined` (or the primary chooses to start anyway), the welcome screen offers a single action: `Begin`. Tapping it dissolves the assembly view and routes to `/` for the first time.
7. **`/`** — Home greets them: `Kia ora, {name}.` Below the greeting sits **Bea's thoughts** — one short, deliberately reflective line drawn from a 30-day rotation (a different one each day, then the cycle repeats). The footer tab bar appears. The header carries a **profile menu** (avatar = uploaded picture, falling back to initials) which holds:
   - Any messages from Bea waiting for them
   - **Notifications** — a first-run prompt to choose what they want to be told about
   - An `Add to home screen` nudge on first visit
   - **Crisis support** — emergency / helpline links for someone who needs to talk to a human right now
   - `Sign out`, and a way to discontinue using Bea entirely
   Once an individual focus is set (Phase 5), it pins to the dashboard underneath the greeting.

### Phase 4 · Setting the rhythms (still day one, optional ~10 min)

8. **`/schedule`** — Taps **Schedule** in the footer. Sees `Rhythms` with empty state `I do not have any times set to be present yet.` and `Establish a rhythm`. Each household decides how often they want a **family connect** — Lian's family lands on once a week, Sunday. Adds, e.g.:
   - "Sunday dinner" → 6:00pm Sunday → **Household conversation** (the family connect itself)
   - "Quiet evenings" → 8:00pm Mon–Fri → **Listen quietly**
9. **`/household`** *(optional)* — At the bottom of the schedule page, follows `Open view` to the household display. This is intended to be left running on a tablet in the kitchen/living room. Shows a large clock, today's date, the next rhythm, and three "listen now" buttons (15 min / 30 min / 1 hr). When a scheduled rhythm fires, this device handles it automatically.

### Phase 5 · The first real conversation — vision and focus

10. **`/check-in`** — Taps **Individual** in the footer:
    - `Kia ora, {name}.` / `Hello, I'm ready for your individual check-in when you are.` / `Begin`.
    - Status cycles: `Arriving...` → `I am here.` with `I am listening.` / `I am speaking.` toggling underneath the voice bars.
    - **Bea opens by asking what they're hoping for** — *"What are you wanting to get out of this? Is there anything I can help with? What's your vision for you, as part of your whānau?"* The conversation produces a **vision** — a few sentences that pin to the top of the individual page from then on.
    - **One thing to focus on.** Before they leave, Bea invites them to pick a single focus to start with — something she'll watch for and reflect back over time. The focus pins to the dashboard underneath the home greeting.
    - Tap `Finish conversation` → `Taking note of what I heard...` → bounced back to `/`.

> The whānau-level equivalent — vision and a single weekly focus, set together — happens in the first family connect (see Phase 6, *the whānau moment*).

### Phase 6 · Returning (ongoing daily use)

Each return looks different but is built from the same handful of moves. Two things matter throughout: **conversational sessions and listen-only sessions are different**, and **whenever Bea is present in the family area, every household member is told.**

- **The check-in** *(conversation)* — Open the app, tap **Individual**, `Begin`, talk. Bea responds. There's no roster step for them; Bea works from who's signed in.
- **The whānau moment** *(conversation)* — Tap **Family** (primary-only tab). Roster shows everyone present: tap `All whānau` to start, or de-select people who aren't there. Members marked `no record kept` show that note inline. Hit `Begin with selection`. Bea takes part in the conversation. **The first time the household runs this**, Bea walks them through the whānau vision — *what do we want to be? where are we now? what's our north star?* — and invites them to pick **one collective thing** to work on this week (e.g. a chore schedule). The whānau vision pins to the top of the family page; the weekly focus pins to the family dashboard.
- **The listen** *(no conversation)* — Tap **Listen** (primary-only tab). Bea is asked who's in the room (or `Skip` to start). Bea then **only listens** — she does not talk back. This is the ambient mode: drop her into a meal or a homework session and let her notice. Individual and Family are conversational; **Listen is purely passive.**
- **The room** — When the device on `/household` reaches a scheduled time, it announces the rhythm with a push notification 5 minutes early (`Bea will start listening quietly in 5 minutes` / `Bea will start a household conversation in 5 minutes`), then begins on its own. The screen shows `{label}.` / `I am listening to the room.` with a soft amber pulse, or runs the live conversation. Anyone in the room can hit `Finish early` / `Finish conversation`.
- **Listening transparency** — Whenever Bea begins listening in the family area (background listen, Listen session, or family conversation), **every household member receives a push**: `Bea is now listening in the family area.` When she stops, a second push: `Bea has stopped listening.` This is non-negotiable; it's how the house keeps consent visible.
- **The look-back** — Tap **Insights**. Sees `What we have shared, {name}.` with `Insights from Bea`. **Insights are produced after every kind of session** — individual check-ins, family sessions, and Listen sessions all generate one; family / Listen sessions also generate a whānau-level insight tagged to everyone who was present. Below that, a collapsible `Timeline` of every session for transparency, each row expandable into themes, suggested focus, family tone. A member only ever sees their own individual rows; whānau / passive rows surface for everyone who was in the room.
- **The audit** *(primary, dev surface)* — `/audit/{goalId}` is a full-bleed, ChatGPT-thinking-style reasoning view: `What Bea heard` on the left, `What Bea considered saying — and didn't` on the right, with rejected drafts, the chosen response, rationale, and an expandable agent thinking trace. The route exists; today the **only way in is a link tucked into the profile-menu settings** — surfaced for the primary as a developer-facing inspection tool while we iterate on the model's reasoning.
- **A crisis ping** — If Bea decides a member is in distress, the primary gets a notification through the profile menu (loaded into the header on every page). It surfaces the affected member's name + briefing.

### What only the primary can do

- See the **Family** and **Listen** tabs in the footer
- Run a guided whānau conversation
- Run an ad-hoc passive recording from `/listen` ("Who is in the room?" → start)
- Open `/household` (the route is gated to `role === 'primary'`)
- Receive crisis notifications about other members
- Open `/audit/{goalId}` from the profile-menu settings (developer-facing inspection)

---

## Journey B — A Non-Primary Member (partner / teen / other whānau)

### Phase 1 · Arrival (first time, ~3 min)

1. **The invite arrives** — An email lands from Bea with a link like `https://bea.app/invite/{token}`. The primary triggered it from their welcome screen; the link carries the household identity *and* the member record already waiting for them.
2. **Tap the link** — Opens to a brief framing screen: who invited them, which household, and what Bea is. They confirm and continue.
3. **Sign in** — Google or magic-link email, same as the primary's `/login`. On success, the invite token is consumed: their auth account is attached to the member record in one step. The primary's welcome screen flips their row from `Pending` to `Joined` in real time.
4. **A short wait, if they're early** — If the primary hasn't yet pressed `Begin`, the new member sees a gentler version of the welcome holding screen: *"Your whānau is still gathering. We will begin together."* Once the primary starts, every joined member's screen transitions to `/` at the same time.

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
