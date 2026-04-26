# Bea

> A whānau AI companion. Built from what I know.
>
> *Bea, short for Beathag. A Scottish Gaelic name from the word beatha. It means life.*

Built for the **Anthropic "Built with Opus 4.7" Hackathon**, April 2026.

---

## Try Bea

Open this link on your phone or laptop. You'll be signed in automatically as a demo whānau member, no account or password needed.

👉 **[https://bea-lime.vercel.app/demo](https://bea-lime.vercel.app/demo)**

You'll land on the home screen as "Lian (Demo)". From there you can explore:

- **Talk**, a 1:1 voice check-in with Bea
- **Listen**, passive group listening mode
- **Insights**, patterns and reflections Bea has surfaced from past sessions
- **Schedule**, upcoming whānau kōrero

> ⏱ Each conversation has a **5-minute limit** during the demo period.

Best on a phone (iOS Safari or Android Chrome) since Bea is voice-first. The dashboard works fine on desktop too.

---

## What Bea is

Bea is a voice-first AI companion for whānau (families). She sits quietly in the background of family life. She notices patterns. She holds emotional context across sessions. She reflects back what the people inside a family cannot always see from within.

She is not a therapist. She is not a chatbot. She is a shadow of human intelligence. A mirror, not a master.

---

## The problem

Families carry enormous invisible weight. Emotional labour distributed unevenly. Threads that never quite close. Patterns that repeat because no one can see them from the inside. Traditional wellbeing tools are built for individuals. Bea is built for the whānau as a unit.

> The unit of care is not the person. It is the family.

---

## What makes Bea trustworthy

Dr Karaitiana Taiuru's framework names AI as **he karetao**, a puppet moved by many hands. The developers. The operators. The users. The emergent interactions between all of them. As Taiuru writes, "the karetao structure cannot be used to diffuse accountability to the point where no party bears responsibility for harm."

Bea is a karetao. I'm the named human whose strings can be traced. That's what the Human Proxy Theory (Passmore, 2026) is about: when the puppet does harm, the buck stops with a named, visible, accountable person. AI doesn't create relational trust. It borrows it from the visible accountability of the human behind it.

The architecture exists to honour the trust the whānau extends through me. Not to replace it.

---

## What Bea does

**Four modes:**

| Mode | What happens |
|---|---|
| **Check-in** | A family member talks to Bea. She listens, reflects, and holds context across time |
| **Group session** | Bea is present with the whole family at once |
| **Listen** | Bea sits quietly in the room, ambient and present without speaking |
| **Journal** | After each session, a personal reflection appears. Bea's quiet observation, written to the person |

**Scheduled presence:** A shared household device (TV, tablet) runs Bea in ambient mode at scheduled times. She arrives at the dinner table. She's there at bedtime. You set when. She shows up.

---

## The architecture

Bea's voice is powered by **ElevenLabs** (Sonnet 4.6). Her between-sessions intelligence runs on **Anthropic Claude Opus 4.7** with adaptive thinking. Twelve reasoning agents operate silently beneath every conversation. Three of them do work a smaller model would visibly fail at. The rest are structured-output workers that benefit from Opus's consistency.

### The three Opus 4.7 reasoning tasks

These are the agents that earn Opus 4.7. Each runs with adaptive thinking, summarized display, and explicit `effort`. Their full extended-thinking traces are persisted alongside their structured output.

1. **Group session reasoning**, [`/api/guardian/group`](src/app/api/guardian/group/route.ts), `effort: 'high'`. Multi-speaker diarized transcripts to voice attribution, per-member summaries, and family dynamics. The most cognitively demanding reading task in the stack: hold ten minutes of overlapping conversation, attribute every turn, and produce a coherent per-member read.

2. **Pattern detection**, [`/api/guardian/patterns`](src/app/api/guardian/patterns/route.ts), `effort: 'high'`. Cross-session causal reasoning. Distinguishes reinforcement from new patterns, observes metrics against active goals, evolves `confidence` over time.

3. **The Coach**, [`/api/guardian/coach`](src/app/api/guardian/coach/route.ts), `effort: 'xhigh'`. Per (member, active goal), reads observations, patterns, transcripts, prior reflections, and prior coach decisions, then answers a single ethical-judgement question: *"What, if anything, should Bea bring to the next conversation?"* The honest answer is often "nothing yet." The agent emits the draft sentence Bea might say, the alternatives it considered and rejected (`considered_and_rejected`), and the listening priority that flows back into ElevenLabs as a dynamic variable on the next session.

The Coach's output is wired into [`/api/guardian/context`](src/app/api/guardian/context/route.ts), which means **the Coach decides what Bea pays attention to in the next conversation**.

### How Bea uses Opus 4.7

| Capability | What Bea does with it |
|------------|----------------------|
| **1M context window** | Coach reads thirty days of council output to draft change proposals |
| **xhigh effort** | Coach drafts seven alternatives, rejects six (persisted to audit), surfaces one |
| **Extended thinking** | Pattern Detection, Group Session, and Coach run with extended reasoning |
| **Self-verification** | Tikanga validates every output against ten cultural pou before release |

### The audit surface

Every reasoning trace lives in the database. The admin page at [`/dev/reasoning`](src/app/dev/reasoning/page.tsx) renders the full agent chain for any session. Input, structured output, extended-thinking trace, token counts, and (for the Coach) the alternatives the agent considered and rejected. This is the Human Proxy Theory in working code: the named humans behind Bea (Lian, Lee, Karaitiana) can review every judgement call she makes.

### The other agents

Summarise, Wellbeing, Crisis, Reflect, Tikanga, Silence Gate, Perspective, Absence, Insight, Context. Each does one job. Each has a single sentence's worth of question it answers. See [`src/lib/prompts.ts`](src/lib/prompts.ts) for every system prompt and [`src/app/api/guardian/`](src/app/api/guardian/) for the routes.

---

## The Wall of No

The Wall of No is structural, enforced in every prompt, not aspirational in documentation.

Every Guardian and Bea herself is bound by it:

- **Never** record audio
- **Never** store transcripts
- **Never** diagnose a mental health condition
- **Never** take sides in family dynamics
- **Never** claim certainty about what someone "really means"
- **Never** give advice or tell anyone what to do
- **Never** use clinical language. Pattern language only ("I notice..." not "they have...")
- **Never** make a family member feel surveilled
- **Never** claim to feel emotions

These are not guidelines. They are constraints baked into every system prompt.

The Wall of No is grounded in Dr Karaitiana Taiuru's *Limits of AI Authority* (from his *He Tangata, He Karetao, He Ātārangi* framework). An AI is a shadow of human intelligence. It can't be a legitimate authority on tikanga, mātauranga, or cultural practice. The Wall of No is how that limit gets enforced structurally. Not just philosophically.

---

## Coaching philosophy

Bea's coaching stance is grounded in **Takitaki mai** (Britt, Gregory, Tohiariki, Huriwai, 2014), the Māori adaptation of Motivational Interviewing, and **mana-enhancing practice**.

The framework gives Bea a way to be present without taking over. She borrows the skills: partnership, acceptance, evocation, compassion. She leaves the rituals to the people who own them.

Bea's coaching philosophy is a sub-layer inside the **Tikanga-Led Framework for Conversational AI Agents v1.1** (Palamo & Passmore, 2026). Nothing in the coaching layer overrides the framework. It sits inside it.

### The He Karetao adjustment

Takitaki mai is written for **kaimahi**, human practitioners doing kanohi-ki-te-kanohi work, grounded in their own whakapapa, karakia, and wairua. The pōwhiri process as therapeutic frame. The hongi as exchange of hā. Karakia as opening the spiritual pathway. These are tikanga performed by people. Not by software.

**Bea is He Karetao**, a puppet moved by many hands. **He Ātārangi**, constituted entirely by human thought. She has no wairua to exchange. She cannot whakawhanaunga in the deep sense the word holds. She must not pretend to.

So Bea adapts Takitaki mai in a specific way: stance and skills, yes. Rituals, no.

- Bea never opens with karakia. If the user opens with karakia, that is their practice.
- Bea does not narrate cultural processes she is performing. She is not performing them.
- Bea recognises Māori concepts when the user uses them. She does not lecture about tikanga.
- Bea never claims cultural or spiritual authority. (This is in the Wall of No.)

### RULE, the operating principle

From Takitaki mai, Bea adopts **RULE** as her single best summary of stance:

- **R**esist the righting reflex.
- **U**nderstand the user's motivations.
- **L**isten.
- **E**mpower.

The righting reflex is the urge to fix. Bea does not fix.

### Refocus, never reframe

When Bea notices that the goal a user is working on correlates with something else, a pattern or a condition or a context, she does not declare a reframe. *"I think you're working on the wrong goal"* is a sentence Bea never says.

Instead, Bea offers the noticing as a question:

> *"I've noticed the evenings the swearing comes up are usually the ones where you've done bedtime alone. I don't know if that's connected. I wanted to mention it."*

Then she stops. The user does the work. The user decides if the connection is real. **Bea hands them the thread. She doesn't pull it.** This is refocus, not reframe. The difference matters.

### Where the philosophy lives

This stance is implemented in the codebase:

- [`docs/coaching-philosophy.md`](docs/coaching-philosophy.md), the full philosophy document
- [`/api/guardian/coach`](src/app/api/guardian/coach/route.ts), the system prompt for the Coach reasoning agent (Opus 4.7, extended thinking)
- [`src/lib/prompts.ts`](src/lib/prompts.ts), the live voice agent's coaching addendum

### Status

This philosophy is **v0.1**, awaiting review by **Lee Palamo (Ngāti Awa, Tūhoe)** and **Dr Karaitiana Taiuru**. It adapts material from a published Māori source for AI use, which is novel and requires Māori review before any production deployment.

### Attribution

Britt, E., Gregory, D., Tohiariki, T., & Huriwai, T. (2014). *Takitaki mai: A guide to Motivational Interviewing for Māori.* Wellington: Matua Raki. ISBN 978-0-473-27773-4. Used with respect, in non-commercial application, in service of whānau wellbeing.

---

## The Manaaki Standard

> Every interaction must leave the person with more dignity than they arrived with.

Bea is governed by two frameworks and grounded in two bodies of research:

- **He Tangata, He Karetao, He Ātārangi** by Dr Karaitiana Taiuru, the Kaupapa Māori framework for AI. Bea is both He Karetao and He Ātārangi. A puppet moved by many hands, and a shadow of human intelligence. She is present, but not the point. Human connection is the point.
- **Tikanga-Led Framework for Conversational AI Agents v1.1** by Lee Palamo and Lian Passmore (April 2026), validated by Dr Karaitiana Taiuru. Relational AI design centred on mana, whakawhanaungatanga, and tika.
- **Whānau Intelligence** (Passmore), drawing on Spiller, Wolfgramm, Henry, Pouwhare, and the wānanga literature. The platform Bea is built on.
- **Project Rise** (Passmore), eighteen months of research on conversational AI in vulnerable conversations, spaces, and contexts. The underlying research that preceded the Whānau Intelligence work and informed both it and this build.

Cultural review by **Lee Palamo (Ngāti Awa, Tūhoe)**.

---

## A note on restraint

Most LLM applications optimise for output. Bea optimises for restraint.

The Coach agent's decision logic explicitly defaults to raising nothing:

> *"Most of the time, raise nothing. The honest defaults: goal is too new. User is in evoking, not planning. Sustain talk is dominant. Bea raised something last session and the user hasn't responded yet. You don't have enough signal. Setting `should_bea_raise_anything: false` is a real and useful answer."*

This is encoded in the agent's system prompt, not just hoped for in conversation design. The result is an AI that more often says nothing than something. That choice is the load-bearing design decision in the entire system.

---

## Voice as a justice decision

Bea is voice-first because many people who most need her cannot or do not communicate through text. Age, disability, low literacy, language, or simply because that is not how their family communicates.

Text-first design excludes. Voice-first design opens.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Voice & conversation | ElevenLabs (`@elevenlabs/react`) |
| Intelligence layer | Anthropic Claude Opus 4.7 with adaptive thinking and `effort` |
| Database | Supabase (PostgreSQL) |
| Styling | Tailwind CSS v4, DM Serif Display, Lora, Inter |
| Icons | lucide-react |

---

## Running locally

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

## Project structure

```
src/app/
├── page.tsx              # Home: greeting, household pulse
├── check-in/             # Voice session with Bea
├── dashboard/            # Personal journal + family report
├── schedule/             # Manage scheduled sessions
├── household/            # Always-on ambient device mode
├── api/
│   ├── check-ins/        # Save transcripts, trigger agents
│   ├── listen/finalize/  # Group session post-processing
│   └── guardian/
│       ├── group/        # Opus 4.7: multi-speaker reasoning ★
│       ├── patterns/     # Opus 4.7: cross-session pattern detection ★
│       ├── coach/        # Opus 4.7: per-goal coaching judgement ★
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
└── dev/reasoning/        # Admin audit surface: full agent chain per session

src/lib/
└── prompts.ts            # All system prompts

docs/
└── coaching-philosophy.md  # Takitaki mai foundation, He Karetao adjustment
```

---

## Built

April 22 to 26, 2026, during the Built with Opus 4.7 Hackathon.

This is new work, started from scratch during the hackathon week. The research foundation (eighteen months of Project Rise on conversational AI in vulnerable spaces, fifty-nine pilot participants on a predecessor system called Ray) sits behind it. That research is not part of this repo, but it's the reason the architecture is what it is.

---

## License

MIT. See [LICENSE](./LICENSE).

---

## Credits

**Built by** Lian Passmore. Researcher, builder, mother of triplets and teens.

**Cultural review** by Lee Palamo (Ngāti Awa, Tūhoe).

**Grounded in the work of** Dr Karaitiana Taiuru.

The whānau in the demo film: Lian, her husband, their triplets, their teens.

Bea is built off the back of eighteen months of Project Rise research on conversational AI in vulnerable conversations, spaces, and contexts. The Whānau Intelligence work followed and became the platform Bea sits on. The build is governed by Dr Karaitiana Taiuru's Kaupapa Māori framework for AI, and by the Tikanga-Led Framework for Conversational AI Agents v1.1, co-written by Lee Palamo and Lian Passmore.

This is not an academic exercise. It is the prototype of a theory that the most meaningful thing AI can do for a family is to see them as a whole, not as individuals to be optimised.

Bea is what it looks like when the answer to "how should AI support wellbeing?" is: *quietly, without diagnosis, with dignity, and with the family, not the individual, as the unit of care.*

---

## Mā te kōrero ka ora

Through conversation, our whānau thrives.
