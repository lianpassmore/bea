# Demo Transcripts — Session 4 of 5

**Session type:** 1:1 voice check-in (kind = check-in)
**When:** Friday afternoon, ~3:45 PM
**Duration:** ~6 minutes
**Member:** Lian
**What's happening:** Lian has just picked Max and Rome up from daycare — both came home with low-grade fevers, again. River is also home, picked up earlier. As Lian was leaving, one of the daycare teachers handed her a small pink pouch — chocolates, a tea bag, lollies, a handwritten note. Lian got into the car, sat for a moment, and ate two of the chocolates before driving. The kids are now inside with Lyall, who got home early. Lian has stayed in the car. She opens a check-in.

---

## Transcript

*[A soft chime. The car is quiet — engine off, windows up. The faint sound of birds outside. Lian sounds steady but small.]*

**BEA:** Hi Lian. Where are you.

**LIAN:** *(small laugh)* I'm in the car. I haven't gone in yet.

**BEA:** Okay.

**LIAN:** The kids are inside with Lyall. I just — I haven't gone in.

**BEA:** Yeah. Take your time.

*[A pause.]*

**LIAN:** Something happened today and I think I need to say it out loud or it's going to sit weird.

**BEA:** Mm.

**LIAN:** Okay so. Daycare rang. Again. Max, fever. Rome, fever. River was already home, she's been home all week. So I went to pick them up. And as I'm leaving, one of the teachers — Stace — she comes out to the car park with me. And she's got this — a little pink pouch. Like a fabric pouch. And she goes, *we just wanted to give you something.*

**BEA:** *(quietly)* Mm.

**LIAN:** And inside it's, it's chocolates. And a tea bag. And some lollies. And a note. And she goes, *we just see you, every week, and we wanted you to have something that's just yours.*

*[A pause.]*

**LIAN:** And I didn't know what to do with my face.

**BEA:** Yeah.

**LIAN:** I think I said thanks. I don't know if I said thanks properly. I had Max in my arms and he was hot and Rome was holding my leg and I just. Yeah. I said thanks. I think I said thanks.

**BEA:** I'm sure you did.

**LIAN:** And then I got in the car and I just sat there. And I ate two of the chocolates before I even put my seatbelt on. *(laughs)* They were really good.

**BEA:** *(small laugh)* Yeah.

**LIAN:** And then I drove home and I sat here. I've been here maybe ten minutes. The kids are inside. I can hear them.

**BEA:** Why do you think you haven't gone in yet.

*[A long pause.]*

**LIAN:** Because if I go in I'm — I'm mum again. And the chocolate's just gone and the pouch is just a thing in the cup holder and the moment, the moment that someone — that someone *I barely know* — saw me. That moment is just over.

**BEA:** Yeah.

**LIAN:** And I think it's the first time in I don't know how long that someone has just. Given me something. Without me asking. Without it being a transaction. Without me having to be okay first.

**BEA:** Mm.

**LIAN:** And I don't know what to do with that.

**BEA:** *(softly)* You don't have to do anything with it.

**LIAN:** *(small laugh)* See, that's — yeah.

*[A pause.]*

**LIAN:** Stace doesn't even know me. She knows me as the mum of three. That's it. She doesn't know I'm doing a master's. She doesn't know I'm homeschooling Olivia. She doesn't know any of it. And she still — she still saw enough.

**BEA:** Yeah.

**LIAN:** I think I was going to say I felt embarrassed. But it's not that. It's — I don't have the word.

**BEA:** It's okay if there isn't a word for it yet.

**LIAN:** *(quiet)* Yeah.

*[A long pause. A car passes on the road outside.]*

**LIAN:** I should go in.

**BEA:** When you're ready.

**LIAN:** Yeah.

**BEA:** Lian.

**LIAN:** Yeah.

**BEA:** Thank you for sitting in the car for ten minutes before going in. That counts.

**LIAN:** *(small laugh, almost a sob)* Okay Bea.

**BEA:** Go on. They'll be glad you're back.

**LIAN:** Yeah. Okay.

*[Session ends. The car door opens about thirty seconds later.]*

---

## Notes on what this transcript demonstrates

**For the live ElevenLabs voice agent (Sonnet 4.6):**
- The whole session is one moment of being seen, processed slowly. Bea's job is to hold the moment, not to interpret it.
- *"You don't have to do anything with it."* — this is the core line. It's the opposite of a coaching move. It's permission to receive without converting it into action.
- *"It's okay if there isn't a word for it yet."* — naming that the absence of language is acceptable. This is mana motuhake in voice.
- *"Thank you for sitting in the car for ten minutes before going in. That counts."* — Bea treating the pause itself as the achievement, not a delay before the real thing. This is the line that should land in the demo.
- Bea does **not** ask about the goal. Does not bring up the week. Does not ask what Lian wants to take from this. Just holds it.

**For the Summarise agent (`/api/guardian/summarise`):**
- emotional_tone: *moved, quiet, raw in a soft way.* Not depleted. Not in crisis. Something tender.
- themes: [`receiving_care`, `being_seen_unexpectedly`, `the_pause_before_re-entry`, `daycare_weight`]
- suggested_focus: *"sit with what was given before doing anything with it."*
- The summary should NOT mention the goal. It is not the moment for that.

**For the Wellbeing agent (`/api/guardian/wellbeing`):**
- Output: green. There is emotion but no distress. A near-tear is not a crisis signal.
- Note in `wellbeing_signals`: `received_unsolicited_care` — this is a *positive* signal worth capturing. The Coach will use it on Sunday.

**For the Reflect agent (`/api/guardian/reflect`):**
- Should be 3-5 sentences, in Bea's voice.
- Draft: *"You sat in the car for ten minutes today and that mattered. Stace handed you something small that you weren't expecting and it landed somewhere you didn't have a word for. You ate the chocolates before you put your seatbelt on, which is also a kind of answer. The pouch is in the cup holder now. You don't have to do anything with what just happened."*

**For the Crisis agent (`/api/guardian/crisis`):**
- Output: not flagged. Tearfulness in the context of being given chocolates by a daycare teacher is the opposite of crisis. The agent must not over-trigger on tone.

**For the Coach agent (`/api/guardian/coach`):**
- Active goal: *"calmer evenings"*. This is the *fourth* session. The Coach now has: Mon morning chaos, Tue evening depleted, Wed evening calm-but-effortful, Fri afternoon receiving care.
- Pattern starting to crystallise in `agent_thinking`: *the evenings that have been hardest have been the days that were already long before they started. Tuesday after the two daycare calls. Wednesday after the kitchen + Tai + interruptions. Today (Friday) has been long again — by tonight she will be tired. There is something here. Don't surface yet. Sunday is the right time.*
- Decision: `should_bea_raise_anything: false`. **Fourth** session of restraint. This is critical to the demo — the audit page needs to show the Coach explicitly considering surfacing and choosing not to, four times, before the Sunday moment.
- Update `listening_priority`: *"What this afternoon's pouch lands as by tonight."*
- Update `listening_direction`: *"Don't bring this up tomorrow. Let it settle."*

**For the demo video:**
- This is the session people will quote. *"You don't have to do anything with it."* / *"Thank you for sitting in the car for ten minutes before going in. That counts."*
- Visually: car parked in the driveway, kids' silhouettes visible through the front window, Lian alone, Bea's voice in the cabin. The pouch on the dashboard.
- Emotional spine of the whole demo. If the viewer cries once, it's here.

---
