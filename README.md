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

## The Guardian Architecture

Bea's voice is powered by **ElevenLabs**. Her intelligence runs on **Anthropic Claude Opus 4.7** — five guardian agents operating silently beneath every conversation.

```
                    ┌─────────────────────┐
                    │   ElevenLabs Agent  │  ← speaks to the family
                    │   (voice + dialogue) │
                    └────────┬────────────┘
                             │ dynamicVariables
                    ┌────────▼────────────┐
                    │   Guardian 2        │  ← runs BEFORE each session
                    │   Context Curator   │     synthesises recent history
                    └─────────────────────┘

         Session ends → transcript saved → Guardians fire in parallel:

    ┌──────────────────┐  ┌───────────────────┐  ┌──────────────────┐
    │   Guardian 1     │  │   Guardian 3       │  │   Guardian 4     │
    │  Summary Oracle  │  │  Wellbeing Monitor │  │ Reflection Writer│
    │  (Opus 4.7 +     │  │  (Opus 4.7 +       │  │  (Opus 4.7,      │
    │   thinking)      │  │   thinking)        │  │   no thinking)   │
    └──────────────────┘  └───────────────────┘  └──────────────────┘

                    On demand (guardian panel):
                    ┌─────────────────────┐
                    │   Guardian 5        │
                    │  Family Insight     │  ← reads across all sessions
                    │  (Opus 4.7 +        │     produces family pattern report
                    │   extended thinking)│
                    └─────────────────────┘
```

### The Five Guardians

**Guardian 1 — Summary Oracle**  
After each session, reads the transcript and produces: an emotional summary, themes, the person's current tone, a family pulse, and a gentle direction for future listening. Uses extended thinking (`budget_tokens: 5000`).

**Guardian 2 — Context Curator**  
Before each session, synthesises the last 5 check-ins into a context brief for Bea: who this person is right now, what they've been carrying, what threads are open, where to listen. Awaited before ElevenLabs connects.

**Guardian 3 — Wellbeing Monitor**  
After each session, reads for signals of distress — not to diagnose, but to notice. Returns a level (green / amber / red) and a brief warm observation. Extended thinking enabled.

**Guardian 4 — Reflection Writer**  
After each session, writes 3–5 sentences as if Bea herself were leaving a quiet note in her journal — addressed to the person, not about them. Intentionally no extended thinking: reflection should feel immediate.

**Guardian 5 — Family Insight**  
On demand, reads across all sessions from all family members and produces a Family Pattern Report: collective emotional climate, what's thriving, what's under pressure, recurring patterns. Extended thinking (`budget_tokens: 7000`).

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
| Intelligence layer | Anthropic Claude Opus 4.7 with extended thinking |
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
└── api/
    ├── check-ins/        # Save transcripts, trigger guardians
    ├── guardian/
    │   ├── summarise/    # Guardian 1 — post-session summary
    │   ├── context/      # Guardian 2 — pre-session context brief
    │   ├── wellbeing/    # Guardian 3 — wellbeing assessment
    │   ├── reflect/      # Guardian 4 — Bea's reflection letter
    │   └── insight/      # Guardian 5 — family pattern report
    └── schedules/        # Schedule CRUD

src/lib/
└── prompts.ts            # All five guardian prompts + Bea's system prompt
```

---

## Why Bea

Lian Passmore's master's research is on relational conversational AI for vulnerable spaces. This is not an academic exercise — it is the prototype of a theory that the most meaningful thing AI can do for a family is to see them as a whole, not as individuals to be optimised.

Bea is what it looks like when the answer to "how should AI support wellbeing?" is: *quietly, without diagnosis, with dignity, and with the family — not the individual — as the unit of care.*
