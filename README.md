# Bea — Whānau Intelligence Companion

> *"He tangata, he tangata, he tangata."*  
> It is people. It is people. It is people.

Bea is a voice-first AI companion for whānau (families). She sits quietly in the background of family life — noticing patterns, holding emotional context across sessions, and reflecting back what the people inside a family cannot always see from within.

She is not a therapist. She is not a chatbot. She is a shadow of human intelligence — a mirror, not a master.

Built for the **Anthropic "Built with Opus 4.7" Hackathon**, April 2026.

---

## The Problem

Families carry enormous invisible weight — emotional labour distributed unevenly, threads that never quite close, patterns that repeat because no one can see them from the inside. Traditional wellbeing tools are built for individuals. Bea is built for the whānau as a unit.

> The unit of care is not the person. It is the family.

---

## What Bea Does

**Four modes:**

| Mode | What happens |
|---|---|
| **Check-in** | A family member talks to Bea — she listens, reflects, and holds context across time |
| **Group session** | Bea is present with the whole family at once |
| **Listen** | Bea sits quietly in the room, ambient and present without speaking |
| **Journal** | After each session, a personal reflection appears — Bea's quiet observation, written to the person |

**Scheduled presence:** A shared household device (TV, tablet) runs Bea in ambient mode at scheduled times. She arrives at the dinner table. She's there at bedtime. You set when; she shows up.

---

## The Architecture

Bea's voice is powered by **ElevenLabs** (Sonnet 4.6). Her between-sessions intelligence runs on **Anthropic Claude Opus 4.7** with adaptive thinking — twelve reasoning agents operating silently beneath every conversation. Three of them do work a smaller model would visibly fail at; the rest are structured-output workers that benefit from Opus's consistency.

### The three Opus 4.7 reasoning tasks

These are the agents that earn Opus 4.7. Each runs with adaptive thinking, summarized display, and explicit `effort`. Their full extended-thinking traces are persisted alongside their structured output.

1. **Group session reasoning** — [`/api/guardian/group`](src/app/api/guardian/group/route.ts) — `effort: 'high'`. Multi-speaker diarized transcripts → voice attribution + per-member summaries + family dynamics. The most cognitively demanding reading task in the stack: hold ten minutes of overlapping conversation, attribute every turn, and produce a coherent per-member read.
2. **Pattern detection** — [`/api/guardian/patterns`](src/app/api/guardian/patterns/route.ts) — `effort: 'high'`. Cross-session causal reasoning: distinguish reinforcement from new patterns, observe metrics against active goals, evolve `confidence` over time.
3. **The Coach** — [`/api/guardian/coach`](src/app/api/guardian/coach/route.ts) — `effort: 'xhigh'`. Per (member, active goal), reads observations + patterns + transcripts + prior reflections + prior coach decisions, and answers a single ethical-judgement question: *"What — if anything — should Bea bring to the next conversation?"* The honest answer is often "nothing yet." The agent emits the draft sentence Bea might say, the alternatives it considered and rejected (`considered_and_rejected`), and the listening priority that flows back into ElevenLabs as a dynamic variable on the next session.

The Coach's output is wired into [`/api/guardian/context`](src/app/api/guardian/context/route.ts), which means **the Coach decides what Bea pays attention to in the next conversation**.

### The audit surface

Every reasoning trace lives in the database. The admin page at [`/dev/reasoning`](src/app/dev/reasoning/page.tsx) renders the full agent chain for any session — input, structured output, extended-thinking trace, token counts, and (for the Coach) the alternatives the agent considered and rejected. This is the Human Proxy Theory in working code: the named humans behind Bea (Lian, Lee, Karaitiana) can review every judgement call she makes.

### The other nine agents

Summarise, Wellbeing, Crisis, Reflect, Tikanga, Silence Gate, Perspective, Absence, Insight, Context. Each does one job; each has a single sentence's worth of question it answers. See [`src/lib/prompts.ts`](src/lib/prompts.ts) for every system prompt and [`src/app/api/guardian/`](src/app/api/guardian/) for the routes.

---

## The Wall of No

The Wall of No is structural — enforced in every prompt, not aspirational in documentation.

Every Guardian and Bea herself is bound by it:

- Never diagnose a mental health condition
- Never take sides in family dynamics  
- Never claim certainty about what someone "really means"
- Never give advice or tell anyone what to do
- Never use clinical language — pattern language only ("I notice..." not "they have...")
- Never make a family member feel surveilled
- Never claim to feel emotions

These are not guidelines. They are constraints baked into every system prompt.

---

## The Manaaki Standard

> Every interaction must leave the person with more dignity than they arrived with.

Bea is governed by three frameworks:

- **He Tangata, He Karetao, He Ātārangi** (Dr Karaitiana Taiuru) — Kaupapa Māori framework for AI. Bea is He Ātārangi: a shadow of human intelligence. She is present, but not the point. Human connection is the point.
- **Tikanga-Led 10-Pou Framework** (Passmore & Palamo, v1.1, April 2026) — relational AI design centred on mana, whakawhanaungatanga, and tika.
- **Project Rise Research** — lived-experience research on conversational AI in vulnerable family contexts.

---

## Voice as a Justice Decision

Bea is voice-first because many people who most need her cannot or do not communicate through text — due to age, disability, low literacy, language, or simply because that is not how their family communicates.

Text-first design excludes. Voice-first design opens.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Voice & conversation | ElevenLabs (`@elevenlabs/react`) |
| Intelligence layer | Anthropic Claude Opus 4.7 with adaptive thinking + `effort` |
| Database | Supabase (PostgreSQL) |
| Styling | Tailwind CSS v4, DM Serif Display, Lora, Inter |
| Icons | lucide-react |

---

## Running Locally

```bash
npm install
```

Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
ANTHROPIC_API_KEY=your_anthropic_key
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_AGENT_ID=your_agent_id
NEXT_PUBLIC_ELEVENLABS_AGENT_ID=your_agent_id
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

Run the Supabase migration:

```bash
supabase link --project-ref your_project_ref
supabase db push
```

Start the dev server:

```bash
npm run dev
```

---

## Project Structure

```
src/app/
├── page.tsx              # Home — greeting, household pulse
├── check-in/             # Voice session with Bea
├── dashboard/            # Personal journal + family report
├── schedule/             # Manage scheduled sessions
├── household/            # Always-on ambient device mode
├── api/
│   ├── check-ins/        # Save transcripts, trigger agents
│   ├── listen/finalize/  # Group session post-processing
│   └── guardian/
│       ├── group/        # Opus 4.7 — multi-speaker reasoning ★
│       ├── patterns/     # Opus 4.7 — cross-session pattern detection ★
│       ├── coach/        # Opus 4.7 — per-goal coaching judgement ★
│       ├── context/      # Pre-session brief; merges Coach's listening_priority
│       ├── summarise/    # 1:1 check-in summary
│       ├── wellbeing/    # Distress signals
│       ├── crisis/       # High-stakes escalation
│       ├── reflect/      # Bea's reflection letter
│       ├── tikanga/      # Cultural-pillars review
│       ├── silence/      # Surface or hold the reflection
│       ├── perspective/  # Internal per-member memos
│       ├── absence/      # What's not being said
│       └── insight/      # Family-wide pulse
└── dev/reasoning/        # Admin audit surface — full agent chain per session

src/lib/
└── prompts.ts            # All system prompts

docs/
└── coaching-philosophy.md  # Takitaki mai foundation, He Karetao adjustment
```

---

## Why Bea

Lian Passmore's master's research is on relational conversational AI for vulnerable spaces. This is not an academic exercise — it is the prototype of a theory that the most meaningful thing AI can do for a family is to see them as a whole, not as individuals to be optimised.

Bea is what it looks like when the answer to "how should AI support wellbeing?" is: *quietly, without diagnosis, with dignity, and with the family — not the individual — as the unit of care.*
