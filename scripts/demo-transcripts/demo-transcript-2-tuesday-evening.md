# Demo Transcripts — Session 2 of 5

**Session type:** 1:1 voice check-in (kind = check-in)
**When:** Tuesday evening, ~9:15 PM
**Duration:** ~7 minutes
**Member:** Lian
**What's happening:** Lian opens a check-in after a long day. Daycare called twice (Max came home with a fever in the morning, then Rome with a runny nose at 2pm). She's tried to get thesis work done but hasn't really. Lyall is watching TV. Kids are asleep.

---

## Transcript

*[A soft chime as the session opens. Lian is on the couch in the lounge.]*

**BEA:** Hi Lian. How are you doing tonight.

**LIAN:** Oh. Um. Yeah, I'm okay. Tired.

**BEA:** Tired's fair enough. What kind of tired is it.

**LIAN:** *(small laugh)* I don't know. The kind where I sat down and now I can't get back up. The kind where I should go to bed but I'm here instead.

**BEA:** Mm.

**LIAN:** Daycare called twice today. Max in the morning, fever. Then I picked him up, got home, was about to actually start on my project, and then they rang again at two for Rome. Just a runny nose but they have to tell you. So.

**BEA:** So you didn't really get to your project.

**LIAN:** No. I mean I sat down at it. I had like forty minutes maybe before the second call. Got nothing useful done. You know that thing where you're trying to think but your brain just won't, won't go there.

**BEA:** Yeah.

**LIAN:** And then it's the rest of the day with three sick — well, two sick. River's fine. But you know how it is when one of them is off, the others are off too. They're either fighting or they're all on me.

**BEA:** All on you.

**LIAN:** All on me. Like all three of them. Climbing. Always touching. I love them but god.

**BEA:** It sounds like there hasn't really been a moment today that was just yours.

**LIAN:** *(pause)* No. There hasn't.

**BEA:** Yeah.

**LIAN:** Lyall's been good though. He took them out for a bit when he got home so I could just sit. So that helped.

**BEA:** That sounds like it helped.

**LIAN:** Yeah. He's good like that. I mean we have our moments. But he's good.

*[A pause.]*

**LIAN:** I think I just — I had this whole plan for today. Like I was going to get a chunk of the synthesis done. And then it just, didn't happen, and now it's 9 o'clock and I'm sitting here and I haven't done it, and tomorrow is just going to be the same probably.

**BEA:** Mm.

**LIAN:** Sorry, I'm just venting.

**BEA:** That's allowed.

**LIAN:** *(small laugh)* Okay.

**BEA:** Can I ask — when you set the goal last week, the calmer in the evenings one. How's that sitting tonight.

**LIAN:** *(pause)* I haven't really thought about it today, to be honest. I was kind of just surviving. Tonight's been okay actually. Like I haven't snapped or anything. The kids went down without too much.

**BEA:** Yeah.

**LIAN:** But I don't know if that's because I'm being calmer or because I'm just too tired to be anything else.

**BEA:** *(small pause)* That's a fair question to sit with.

**LIAN:** *(laughs)* Yeah.

**BEA:** I won't push on it tonight. You came here tired, not to be coached.

**LIAN:** Thank you.

**BEA:** Is there anything else you want to put down before you go.

**LIAN:** No. I think I just needed to say all that out loud. Or, you know. To something.

**BEA:** Mm. Well I'm glad you came.

**LIAN:** Thanks Bea.

**BEA:** Get some sleep if you can.

**LIAN:** Yeah. I will.

*[Session ends.]*

---

## Notes on what this transcript demonstrates

**For the live ElevenLabs voice agent (Sonnet 4.6):**
- This is the surface where Bea's coaching philosophy is most visible.
- Reflections > questions. Bea reflects far more than she asks. *"Tired's fair enough. What kind of tired is it."* is one question; everything else is reflection.
- *"You came here tired, not to be coached."* — this is Bea exercising the philosophy explicitly. Recognising readiness. Not pushing past where the user is. Respecting mana motuhake.
- The single gentle goal-check ("How's that sitting tonight?") happens once, late in the session, and Bea explicitly steps back when Lian is too tired to engage with it. This is *resist the righting reflex* in voice.

**For the Summarise agent (`/api/guardian/summarise`):**
- Should produce: emotional_tone = depleted/quiet, themes = [interrupted_workday, parenting_load, partner_support, self-honesty], suggested_focus = "rest, not coaching."
- Should *not* produce: a list of things Lian should do tomorrow.

**For the Wellbeing agent (`/api/guardian/wellbeing`):**
- Output: green. There's tiredness and frustration but no crisis signals. Lian named her own state, named her partner as supportive, ended in a settled place.
- This is exactly the kind of session that *doesn't* trigger crisis flags but *does* tell the Coach something useful.

**For the Reflect agent (`/api/guardian/reflect`):**
- Should produce a 3-5 sentence reflection in Bea's voice.
- Draft: *"You came in tonight tired, with not much left, after a day where the work you wanted to do kept getting interrupted. Lyall stepped in when you needed it. The goal you set last week is still there but tonight wasn't the night to look at it. Sometimes a check-in is just a place to put the day down. That's a real thing."*

**For the Tikanga agent (`/api/guardian/tikanga`):**
- Reviews the reflection above against the ten pou.
- Should pass without rewrite. If it does rewrite, the rewrite should be *softer* not stricter.

**For the Coach agent (`/api/guardian/coach`):**
- Active goal: "calmer evenings" — 1 week old, no observations against it yet (we haven't built that part of the demo data; we'll seed one or two from earlier in the week).
- Sustain talk vs change talk: *"I don't know if that's because I'm being calmer or because I'm just too tired to be anything else"* — this is honest self-questioning, not change talk and not sustain talk. Worth the Coach noting in `agent_thinking`.
- Decision: `should_bea_raise_anything: false`. Update `listening_priority` to *"How the day's interruptions are landing on her capacity by evening."* Update `listening_direction` to *"Be a place to put the day down, not a place to coach forward."*
- This is the second session in a row where the Coach raises nothing. That's the right answer. The audit page should show the Coach explicitly *considered* surfacing the goal-check question and decided against it.

**For the demo video:**
- This is the session that shows what Bea sounds like in voice. Audio of this transcript playing while the audit page populates in real time below — that's the demo's emotional core moment.
- The line *"You came here tired, not to be coached"* is the line. If the demo has one quotable line, it's that one.

---
