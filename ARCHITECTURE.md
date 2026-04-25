# Bea — System Architecture

A reference for how Bea is set up, what she does, and where each piece lives.
Last updated: 2026-04-25.

---

## 1. What Bea is

Bea is a family coach. She listens to ordinary household conversations and to
one-to-one check-ins with each family member, then helps the family see the
patterns they cannot see from inside — the recurring frictions, the small
moments of repair, the shifts in tone. She is voice-first, hosted through an
ElevenLabs Conversational AI agent (Claude Sonnet 4.6 LLM, Scottish-woman
voice). The web app is a Next.js 16 application deployed on Vercel; everything
else lives in Supabase.

**Three jobs:**
1. **Listen** — capture conversations safely (voice → transcript → attributed
   transcript per family member).
2. **See patterns** — read those transcripts in batch with Claude agents to
   produce per-session insights, cross-session patterns, and a coaching loop
   (goals → observations → milestones).
3. **Coach** — surface what was noticed back to the family, gently, in voice,
   when the moment calls for it.

The family is the unit. Every individual conversation serves that unit.

---

## 2. High-level diagram

```
                Voice in the home
                       │
       ┌───────────────┴───────────────┐
       │                               │
  1:1 check-in                    Household
  (ElevenLabs                  passive listen
   guided)                     (Azure diarize)
       │                               │
       └───────────────┬───────────────┘
                       ▼
        Next.js API routes (Vercel)
                  │
       ┌──────────┼─────────────┐
       │          │             │
    Supabase   Anthropic     Azure Speech
    (Postgres) (Claude +     (Fast Transcription
                memory)       + Speaker Recognition)
       │          │             │
       └──────────┼─────────────┘
                  ▼
    Reflections / Patterns / Goals / Milestones
                  │
                  ▼
       Web dashboards (PWA)
       Push notifications
       Bea brings them up,
       gently, in next session
```

**Data store:** Supabase (Postgres + Storage + Auth + RLS).
**LLM:** Anthropic Claude (Sonnet 4.6 inside ElevenLabs, Opus 4.7 for batch
guardian agents).
**Speech:** Azure Cognitive Services — Fast Transcription with diarization for
group sessions, Speaker Recognition for member voice ID.
**Voice agent:** ElevenLabs Conversational AI (one agent: "Bea").
**Memory:** Anthropic Memory Store, one shared store for the whole household.

---

## 3. Surfaces (where users meet Bea)

| Surface | Code | What it does |
|---|---|---|
| `/check-in` | [src/app/check-in/](src/app/check-in/) | 1:1 voice session. Identifies member via Azure voice ID (or chooses by name), pulls listening context, opens an ElevenLabs session with dynamic variables, records transcript, fires guardian pipeline. |
| `/check-in` (family mode) | [src/app/check-in/family-check-in.tsx](src/app/check-in/family-check-in.tsx) | Guided whole-family check-in. Multiple speakers in one session. Records audio, sends to Azure for diarization. |
| `/listen` | [src/app/listen/](src/app/listen/) | Passive household listening. Bea sits silently in the room; only Azure transcribes. No voice agent runs. Used to capture organic family conversation. |
| `/household` | [src/app/household/](src/app/household/) | Member roster management — add, view, voice-enroll, withdraw. Primary-only. |
| `/reflections` | [src/app/reflections/](src/app/reflections/) | Timeline of Bea's per-session reflections, merged across 1:1s and group sessions. |
| `/schedule` | [src/app/schedule/](src/app/schedule/) | Rhythm management — recurring listen / check-in / group prompts. |
| `/setup` | [src/app/setup/](src/app/setup/) | New-member onboarding: consent, name, 30-second voice enrollment to Azure. |
| `/welcome`, `/login` | [src/app/welcome/](src/app/welcome/), [src/app/login/](src/app/login/) | OAuth/magic-link sign-in and post-auth member-link gating. |
| `/` (home) | [src/app/page.tsx](src/app/page.tsx) | Dashboard. Shows a daily affirmation line ([src/lib/daily-lines.ts](src/lib/daily-lines.ts)), unseen Guardian-10 crisis notifications, recent reflections, family pulse. |
| `/audit/[goalId]` | [src/app/audit/[goalId]/](src/app/audit/[goalId]/) | Per-goal audit surface. Renders observations, sessions, and every Coach run for the goal — including the extended-thinking trace and the alternative drafts the Coach considered and rejected. The Human Proxy Theory in working code. |
| `/dev/reasoning` | [src/app/dev/reasoning/](src/app/dev/reasoning/) | Developer-only reasoning audit. Side-by-side timeline of every agent that ran on a session (1:1, group, or family insight), with each agent's structured output, thinking trace, and override notes (tikanga rewrite, crisis replacement, silence decision). |
| PWA push | [src/lib/web-push.ts](src/lib/web-push.ts) | Browser notifications for advance/start/end of scheduled sessions and crisis alerts. Subscribe / unsubscribe / prefs are handled via server actions in [src/app/actions/](src/app/actions/). |

---

## 4. The session lifecycle (1:1 voice check-in)

This is the core loop. Other surfaces (group, passive) are variants.

```
User taps Begin
      │
      ▼
  Voice identify (Azure Speaker Recognition) → member_id
      │
      ▼
  GET /api/guardian/context?memberId=...    ← reads memory cache + most recent coach_read
      │      returns { individual_summary, family_summary,
      │                emotional_tone, open_threads,
      │                listening_direction, listening_priority,
      │                last_checkin_date }
      │      listening_priority + listening_direction are overridden by the
      │      most recent Coach run (last 14 days). That's how the Coach's
      │      between-session reasoning shapes Bea's next conversation.
      ▼
  conversation.startSession({
      agentId, dynamicVariables: {
          user_name, user_member_id,
          last_checkin_date, individual_summary, family_summary,
          emotional_tone, open_threads,
          listening_direction, listening_priority
      }
  })
      │      ElevenLabs places the variables into BEA_SYSTEM_PROMPT and runs
      │      the Bea agent (Claude Sonnet 4.6) against the user's voice.
      │      During the call Bea may invoke any of her 7 webhook tools.
      ▼
  Conversation ends. Transcript captured.
      │
      ▼
  POST /api/check-ins   ← saves transcript, returns check_in_id, fires guardians
      │
      ├── /api/guardian/summarise     (G1: individual_summary, themes, focus)
      │       └── for each active goal owned by this member:
      │             /api/guardian/coach   (Opus 4.7 extended-thinking; writes coach_reads)
      ├── /api/guardian/wellbeing     (G3: green/amber/red + signals)
      ├── /api/guardian/reflect       (G4: 3-5 sentence Bea reflection)
      ├── /api/guardian/absence       (G9: what went quiet — internal only)
      └── /api/guardian/crisis        (G10: only if wellbeing flagged)
              │
              ├── G7 tikanga check on every reflection → may rewrite
              ├── G6 silence gate decides if surfaces to dashboard
              └── G10 may write crisis_notifications + replace reflection
```

For passive household + guided family sessions, the lifecycle runs through
`/api/listen/finalize` → `/api/guardian/group` → **`/api/guardian/patterns`**
(per-session insight + cross-session pattern reinforcement), which then
fans out one **`/api/guardian/coach`** call per (member × active goal) it
encountered. Coach output is what Context will surface to the next session
via `listening_priority` / `listening_direction`.

---

## 5. The agents (Claude calls)

Every agent is a single Claude call with a dedicated system prompt in
[src/lib/prompts.ts](src/lib/prompts.ts). They are fire-and-forget — invoked
by `fetch(...)` after the user has already received their response.

### 5a. Per-session guardians (1:1)

| # | Agent | Route | Output |
|---|---|---|---|
| 1 | **Summarise** | `/api/guardian/summarise` | individual_summary, themes[], emotional_tone, family_pulse, suggested_focus. Also writes member context to Anthropic memory store. |
| 2 | **Context** (pre-session) | `/api/guardian/context` | listening_priority, listening_direction, open_threads, individual_summary, family_summary, emotional_tone, last_checkin_date. Reads memory store. Output is what the dashboard and ElevenLabs agent consume. |
| 3 | **Wellbeing** | `/api/guardian/wellbeing` | wellbeing_level (green/amber/red), signals[], escalate. Triggers G10 on red. |
| 4 | **Reflect** | `/api/guardian/reflect` | 3–5 sentence Bea-voice reflection. May be replaced by G10's `crisis_in_session_response`. |
| 7 | **Tikanga** | `/api/guardian/tikanga` | Validates reflection against ten pou; may rewrite. Original preserved in `*_original` columns. Hidden from voice, does affect what gets stored. |
| 6 | **Silence** | `/api/guardian/silence` | surface / wait / never. Controls whether reflection appears on the dashboard. |
| 9 | **Absence** | `/api/guardian/absence` | What went quiet vs. prior themes. Internal only — never user-facing. Feeds G2/G5/G6. |
| 10 | **Crisis** | `/api/guardian/crisis` | crisis_level (watchful/concerned/urgent), in-session response, contact briefing. Creates rows in `crisis_notifications`. Only fires if G3 returned amber/red or transcript trips signals. Extended-thinking trace stored in `check_ins.crisis_agent_thinking` for audit. |

### 5b. Cross-session / family-level

| # | Agent | Route | Output |
|---|---|---|---|
| 5 | **Insight** | `/api/guardian/insight` | Family-wide pulse: thriving[], under_pressure[], recurring_patterns[], worth_attention. Reads recent per-member summaries. |
| 8 | **Perspective** | `/api/guardian/perspective` | "From [name]'s perspective this week..." memo. Internal only — informs how Bea listens. |

### 5c. Group-session pipeline

| # | Agent | Route | Output |
|---|---|---|---|
| 11 | **Group** | `/api/guardian/group` | Reads diarized transcript + roster → speaker_map (which speaker # is which member, including is_bea), family_summary/themes/tone/pulse, per_member_summaries[]. Writes to `listening_sessions` and `listening_member_summaries`. After it completes, fires the pattern detection agent. |
| — | **Pattern Detection** | `/api/guardian/patterns` | Per-session insight + cross-session pattern reinforcement. Writes `session_insights`, `observations` (matched to active goals' `metric_key`), `patterns` (create or reinforce — single sessions can never create high-confidence patterns), and auto-awards session-count milestones. After writing, fans out to the Coach agent per (member × active goal). |

### 5d. Coach (Opus 4.7 extended-thinking, per goal)

| # | Agent | Route | Output |
|---|---|---|---|
| — | **Coach** | `/api/guardian/coach` | Per (member × active goal). Reads the goal, its observations (last 30 days), open patterns touching the member (last 30 days), recent 1:1 + group summaries (last 14 days), and prior coach reads (last 14 days). Produces `coach_read` (progress, user_felt_experience, change/sustain talk), `next_session_guidance` (always populated `listening_priority` + `listening_direction`; nullable `offer_to_raise` and `refocus_question` drafts in Bea's voice), and `considered_and_rejected[]` — the alternative drafts the agent chose against. Persisted to `coach_reads` with the full extended-thinking trace. Uses `claude-opus-4-7` with `thinking: { type: 'adaptive', display: 'summarized' }` and `output_config: { effort: 'xhigh' }`. |

The Coach is the fourth Opus 4.7 reasoning task (alongside Pattern Detection,
Family Insight, Crisis). It does not speak to the user — it shapes what Bea
listens for next time. The audit surfaces (`/audit/[goalId]`, `/dev/reasoning`)
exist so a human reviewer can see the judgement calls it made.

---

## 6. The voice tools (Bea's hands)

Seven ElevenLabs webhook tools. Bea calls them during a guided session, when
the moment calls for it. She is instructed in her system prompt to never lead
with a tool, never recite results unprompted, and never confirm a goal without
explicit user agreement. Tool URLs all live under
[src/app/api/bea-tools/](src/app/api/bea-tools/).

| Tool | Method | Purpose |
|---|---|---|
| `fetch_family_context` | GET | Once per session at the start. Returns members, open goals, recent patterns, recent milestones, session count. |
| `fetch_active_goals` | GET | Mid-conversation lookup of what's currently being tracked for a member or whānau. |
| `propose_goal` | POST | Drafts a new goal in `status='draft'`. Does **not** start tracking. |
| `confirm_goal` | POST | Flips `draft` → `active`. Only after explicit user agreement. |
| `log_observation` | POST | Records a numeric value against an active goal (e.g. swear count this session). |
| `log_milestone` | POST | Marks a worth-celebrating moment. Idempotent on (owner, kind). |
| `get_recent_patterns` | GET | Surfaces a recently noticed pattern Bea may want to gently raise. |

Tool registration happens via [elevenlabs/add-all.sh](elevenlabs/add-all.sh)
which batch-creates them on ElevenLabs and returns the tool IDs to attach to
the agent. Configs are in [elevenlabs/tool_configs/](elevenlabs/tool_configs/).

---

## 7. Data model

All tables live in Supabase, all use `uuid` primary keys, `created_at` is
`timestamptz NOT NULL DEFAULT now()`, RLS is enabled with permissive policies
(server-only access via the service-role key).

### Identity & consent
- **`members`** — household roster. `id`, `name`, `role` (`primary` | `family`), `email`, `auth_user_id` (FK to `auth.users`), `azure_profile_id`, `voice_enrolled`, `consent_given_at`, `consent_withdrawn_at`, `status` (`active` | `held` | `withdrawn`), `avatar_url`. `held` covers members in the household whose consent has not been recorded (typically minors) — they are attributed in group transcripts but excluded from per-member summaries and reflections.

### Sessions
- **`check_ins`** — 1:1 voice sessions. Holds `transcript`, `summary`, `themes`, `emotional_tone`, `family_pulse`, `suggested_focus`, `wellbeing_level`, `signals`, `reflection`, `reflection_original`, all crisis_* fields including `crisis_agent_thinking` (G10's extended-thinking trace), `guardian_thinking` (G1's trace), `member_id`, `agent_id`, `is_guest`.
- **`listening_sessions`** — group sessions (passive or guided). Holds `roster`, `raw_transcript`, `attributed_transcript`, `speaker_map`, `family_summary/themes/tone/pulse`, `kind` (`passive` | `guided`), `eleven_labs_transcript` (only for guided), `status` (`pending` | `transcribed` | `attributed` | `failed`).
- **`listening_member_summaries`** — per-member outputs from a group session: `individual_summary`, `themes`, `emotional_tone`, `suggested_focus`, `reflection`. Unique on (session_id, member_id).

### Coaching loop (added 2026-04-25)
- **`goals`** — `owner_type` (`member` | `whanau`), `owner_id`, `title`, `metric_key`, `direction`, `baseline`, `target`, `status` (`draft` | `active` | `paused` | `achieved` | `archived`), `proposed_by` jsonb.
- **`observations`** — `goal_id`, `session_id`, `value`, `note`, `observed_at`. One row per metric value Bea or the pattern agent records.
- **`session_insights`** — one row per `listening_session`. `per_member` jsonb (tone, notable_moments, observed_metrics by member), `whanau` jsonb, `agent_thinking`. The pattern agent's structured output for that session.
- **`patterns`** — cross-session corroborated observations. `scope`, `subject_id`, `kind`, `severity`, `confidence` (0..1), `supporting_session_ids[]`, `status` (`new` | `discussed` | `dismissed` | `resolved`), `first_seen_at`, `last_seen_at`. Single sessions cap confidence at 0.4 — patterns must be reinforced.
- **`milestones`** — `owner_type`, `owner_id`, `kind`, `title`, `payload`, `achieved_at`. Unique on (owner, kind) to enforce one-time awards.
- **`coach_reads`** — one row per Coach agent run. `session_id` or `check_in_id` (one of the two is set), `member_id`, `decision` (`raise` | `wait` | `note`), `response` (the line Bea would say if `decision='raise'`), `rationale`, `listening_priority`, `listening_direction`, `agent_thinking` (full extended-thinking trace), `considered_and_rejected` jsonb (alternative drafts and why they were rejected). Read by `/api/guardian/context` to override the next session's listening priority. Indexed on `session_id`, `check_in_id`, and `member_id`.

### Safety & operations
- **`crisis_notifications`** — Guardian-10 alerts to designated contacts. `check_in_id`, `affected_member_id`, `contact_member_id`, `crisis_level`, `briefing`, `seen_at`.
- **`schedules`** — recurring listen/check-in/group prompts. `label`, `days[]`, `time`, `mode`, `active`.
- **`push_subscriptions`** — Web Push endpoints. `endpoint`, `p256dh`, `auth`, `member_id`, `prefs` jsonb (which categories to receive).
- **`family_insights`** — older table holding G5 outputs. Has `silence_evaluation`, `insight_original` columns.

### Storage bucket
- **`avatars`** (Supabase Storage) — public read, authenticated write. Holds member avatar images.

---

## 8. API surface

Grouped by purpose. All routes are Next.js 16 server route handlers.

### Conversation entry/exit
- `POST /api/listen/finalize` — accept room audio, run Azure Fast Transcription with diarization, save raw transcript to `listening_sessions`, fire `/api/guardian/group`.
- `POST /api/transcripts` — ElevenLabs webhook for guided family sessions. Saves transcript with `kind=guided`, fires group guardian.
- `POST /api/check-ins` (and `GET`) — 1:1 transcripts. POST saves and fires the per-session guardian pipeline. GET returns the latest 1:1 + family session for the dashboard.
- `POST /api/voice` — synchronous text-to-speech via ElevenLabs.

### Voice identity
- `POST /api/voice/enroll` — 30-second audio → Azure Speaker Recognition profile creation (polled up to 60s). Sets `azure_profile_id`, `voice_enrolled=true`. `DEMO_FAKE_VOICE` env flag bypasses Azure for local dev.
- `POST /api/voice/identify` — check-in audio → Azure identify → returns matched `member_id`, name, confidence (threshold 0.7).

### Guardian agents
See [§5](#5-the-agents-claude-calls). All under `/api/guardian/*`. The Coach
agent (`/api/guardian/coach`) is included here even though it is not numbered
G1–G11 — it is the fourth Opus 4.7 reasoning task in the system.

### Coaching loop CRUD
- `GET/POST /api/goals`, `GET/PATCH/DELETE /api/goals/[id]`
- `GET/POST /api/observations`
- `GET /api/patterns`, `GET/PATCH/DELETE /api/patterns/[id]`
- `GET/POST /api/milestones`

### Voice agent webhook tools
See [§6](#6-the-voice-tools-beas-hands). All under `/api/bea-tools/*`.

### Operations
- `GET/POST /api/members`, `POST /api/members/[id]/withdraw`
- `GET/POST/PATCH/DELETE /api/schedules`, `/api/schedules/[id]`
- `POST /api/profile/avatar`
- `POST /api/notifications/broadcast` — sends push to all active subscriptions, filtered by `prefs`. Prunes dead endpoints.
- `GET /api/crisis-notifications/[id]`, `POST /api/crisis-notifications/[id]/seen`
- `GET /api/reflections` — merged timeline of 1:1 + group reflections.
- `GET /api/memory/init` — one-shot creates the Anthropic memory store; copy the returned `store_id` into `ANTHROPIC_MEMORY_STORE_ID`.
- `POST /api/chat` — text-mode chat using the same `BEA_SYSTEM_PROMPT`. Used by web chat surfaces; not the voice path.

### Server actions
Live under [src/app/actions/](src/app/actions/). These run as Next.js server
actions, not REST endpoints.
- `subscribeUser` / `unsubscribeUser` ([push.ts](src/app/actions/push.ts)) — manage Web Push subscriptions, write to `push_subscriptions`.
- `updatePrefs` / `getPrefs` ([notification-prefs.ts](src/app/actions/notification-prefs.ts)) — toggle which notification categories a subscription receives.

---

## 9. Configuration

### Environment variables (Vercel + `.env.local`)
| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase admin |
| `ANTHROPIC_API_KEY` | Claude calls in all guardian agents |
| `ANTHROPIC_MEMORY_STORE_ID` | Per-household persistent memory |
| `NEXT_PUBLIC_BASE_URL` | Used by `/api/guardian/group` to fire `/api/guardian/patterns` (must be the public URL on prod) |
| `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | Azure Fast Transcription + Speaker Recognition |
| `ELEVENLABS_API_KEY` | TTS, agent admin (CLI), tool registration |
| `ELEVENLABS_VOICE_ID` | Bea's voice |
| `ELEVENLABS_AGENT_ID`, `NEXT_PUBLIC_ELEVENLABS_AGENT_ID` | The Bea conversational agent |
| `ELEVENLABS_WEBHOOK_SECRET` | Verifies inbound webhooks from ElevenLabs |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push |
| `DEMO_FAKE_VOICE` | Bypass Azure for voice enroll/identify in dev |

### ElevenLabs dynamic variables (passed at session start)
The voice agent expects these placeholders to be filled. They're set in
[src/app/check-in/check-in-client.tsx](src/app/check-in/check-in-client.tsx):
- `user_name`, `user_member_id`
- `last_checkin_date`
- `individual_summary`, `family_summary`
- `emotional_tone`, `open_threads`
- `listening_direction`, `listening_priority`

For non-1:1 sessions (family check-in, passive listen, guest), `user_member_id`
is passed as `''` — Bea is instructed to use `fetch_family_context` for
roster lookups in those modes.

The system prompt itself lives in two places:
- [elevenlabs/system_prompt.md](elevenlabs/system_prompt.md) — copy-paste-ready
  for the ElevenLabs dashboard. **The dashboard prompt is the source of truth
  for the voice agent.**
- [src/lib/prompts.ts](src/lib/prompts.ts) `BEA_SYSTEM_PROMPT` — used by
  `/api/chat` (text surfaces).

---

## 10. Deployment

| Concern | Where |
|---|---|
| Hosting | Vercel — `https://bea-lime.vercel.app`. Auto-deploys from `main`. |
| Repository | `github.com/lianpassmore/bea` |
| Database | Supabase (`NEXT_PUBLIC_SUPABASE_URL`). Migrations applied via Supabase dashboard or CLI. |
| Voice agent | ElevenLabs Conversational AI, agent name "Bea", LLM Claude Sonnet 4.6. Tool IDs attached via PATCH to `/v1/convai/agents/{id}`. |
| Speech | Azure Cognitive Services region `australiaeast`. |

---

## 11. Architectural patterns to know about

**Fire-and-forget guardians.** When a session ends, the user gets an immediate
response. All guardian work runs in parallel `fetch(...)` calls without
awaiting. There is no job queue — Vercel serverless picks them up.

**Two-pass voice agent.** ElevenLabs (Sonnet 4.6) handles live conversation
fast and warm. Heavier reasoning (pattern detection, family insight, crisis
classification) runs in batch on Opus 4.7 between sessions. Warmth lives in
voice; intelligence lives in agents; truth lives in Supabase.

**Pattern detection runs after every session.** `/api/guardian/group` chains
into `/api/guardian/patterns` once attribution finishes. The pattern agent does
two passes: (1) per-session observations against any active goal whose
`metric_key` matches, (2) cross-session pattern updates that either reinforce
an existing pattern or create a new low-confidence candidate (≤ 0.4).

**Coach closes the loop.** After every session, the Coach agent runs once per
(member × active goal): from `/api/guardian/summarise` for 1:1s, and from
`/api/guardian/patterns` for group/passive sessions. Coach's
`listening_priority` and `listening_direction` are persisted to `coach_reads`,
and `/api/guardian/context` reads the most recent row (last 14 days) and
overrides the synthesised brief with it. The Coach's between-session reasoning
is therefore what shapes how Bea listens at the start of the next conversation
— not directly what she says, but what she's tuned for. Drafts she might raise
(`offer_to_raise`, `refocus_question`) and the alternatives she rejected
(`considered_and_rejected[]`) are kept for human review.

**Drafts require explicit consent.** Any goal Bea proposes lands in
`status='draft'`. Tracking only begins when the user explicitly confirms in
voice and Bea calls `confirm_goal`.

**Tikanga as safety valve.** Every reflection passes through Guardian 7 before
storage. If it fails the ten-pou check, the rewrite replaces the original;
both are kept in `*_original` columns for audit.

**Silence as a first-class output.** Guardian 6 can decide that a particular
insight should not surface. The dashboard hides anything where
`silence_decision != 'surface'`.

**Consent honoured at every layer.** Guests skip persistence entirely.
Withdrawn members keep their voice profile but no new content is created.
Group sessions attribute non-consented members in the speaker map (so
transcripts read correctly) but do not generate per-member summaries for them.

**Memory is per-household, not per-member.** One Anthropic memory store id is
shared across the family. Guardian 1 writes per-member paths
(`/members/{id}/last_session.json`, `/members/{id}/context.json`) right after
saving its summary; Guardian 2 reads `/members/{id}/context.json` as a hot
cache at the start of the next session, then merges in the most recent
`coach_reads` row before returning. Read/write helpers live in
[src/lib/memory.ts](src/lib/memory.ts).

**Audit is a first-class surface.** Every agent that uses extended thinking
persists its trace alongside its structured output (`guardian_thinking`,
`crisis_agent_thinking`, `agent_thinking` on `coach_reads` and
`session_insights`). The Coach also persists its rejected drafts. Two
audit surfaces consume this: `/audit/[goalId]` for a single goal's history,
and `/dev/reasoning` for a full per-session agent timeline.

---

## 12. What is not done yet

- The Coach prompt is at v0.1 and has not yet been tuned against real
  sessions. Lian + Lee + Karaitiana are the cultural-authority loop; their
  review is pending.
- The pattern detection + coaching loop are deployed and live, but no goals
  exist in production yet — the system has nothing to track until someone
  says "I want to..." in a session and Bea drafts a goal.
- The Coach's `offer_to_raise` and `refocus_question` drafts are persisted
  to `coach_reads.response`, but Bea's voice agent does not yet read them
  back at session start (only `listening_priority` / `listening_direction`
  flow through). Wiring the actual draft into the dynamic variables is the
  next step in closing the speaking side of the loop.
- Push notifications work but are not yet wired to most automatic triggers
  (currently invoked ad-hoc from `/api/notifications/broadcast`).
- The Anthropic memory store is used by Guardians 1 + 2 (write/read of
  per-member context). The pattern and coach agents persist their
  thinking traces to Postgres rather than the memory store; whether to
  surface them via memory paths as well is an open design question.
- Family-mode and passive-listen sessions still run through `BEA_SYSTEM_PROMPT`
  even though her tools assume a single speaker. The prompt instructs her to
  use `fetch_family_context` for roster lookups when `user_member_id` is empty,
  which is enough for the demo, but a dedicated family-mode prompt would be
  cleaner long-term.
- The Alexa handler at [src/app/api/alexa/handler/route.ts](src/app/api/alexa/handler/route.ts)
  is dormant. Skill registration could not be completed in time for the
  hackathon demo, so the route is parked — no code outside it depends on
  it. Removing or restoring it is a one-step decision.
