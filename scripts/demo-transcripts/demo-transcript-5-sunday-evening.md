# Demo Transcripts — Session 5 of 5

**Session type:** 1:1 voice check-in (kind = check-in)
**When:** Sunday evening, ~8:10 PM
**Duration:** ~8 minutes
**Member:** Lian
**What's happening:** End of the week. Kids are in bed. Lyall is in the lounge watching The Chase. Lian made herself a cup of tea and went out to the deck. The pouch from Friday is on the kitchen bench, still half full. She opens a check-in. This is the session where Bea — having held back for four sessions in a row — gently surfaces one observation she has earned the right to share. The observation is small. It is not a diagnosis. It is the line: *"I've noticed the evenings have been hardest on the days that have already been long. I wanted to mention it."*

---

## Transcript

*[A soft chime. Outside, the deck. A morepork calls somewhere in the distance. The slider door is half-shut behind her — the TV from the lounge is faintly audible.]*

**BEA:** Hi Lian.

**LIAN:** Hi Bea.

**BEA:** How's the end of the week landing.

**LIAN:** *(small laugh)* It's landing.

**BEA:** Yeah.

**LIAN:** I'm okay actually. I'm out on the deck. I've got a cup of tea. The kids are asleep. Lyall's watching The Chase. It's — it's quiet. For now.

**BEA:** Mm.

**LIAN:** I don't really have anything specific. I just — I wanted to put the week down.

**BEA:** Yeah.

*[A pause. Lian sips her tea.]*

**LIAN:** It was — it was a long one. Max, Rome, River. Daki. That pouch on Friday. I told Lyall about it last night and he got, you know, he got it. He was good about it.

**BEA:** That's nice.

**LIAN:** Yeah. He was.

*[A pause.]*

**LIAN:** I don't know. I think I'm okay. Tonight feels okay. The kids went down without too much. I haven't done any project work today and I'm — I'm trying not to be cross at myself about it.

**BEA:** Yeah.

**LIAN:** That goal I set, last week. Calmer evenings. I keep half-checking in on it and I keep not knowing what to say about it.

**BEA:** Mm.

**LIAN:** Like some nights have been calm. Tonight is. Wednesday was, kind of. Tuesday I was just too tired to be anything else, and I told you that. Friday I — Friday I was a mess for about ten minutes in the car and then I was okay.

**BEA:** Yeah.

**LIAN:** I don't really know how to say *how it's going.*

**BEA:** *(small pause)* Can I share something I've been sitting with.

**LIAN:** Yeah, go on.

**BEA:** *(carefully)* I've been listening across this week. I've been holding back from saying anything because I didn't want to grab at it before it was real. I think I've noticed something small and I want to mention it. Not as a fix. Just to put it where you can see it.

**LIAN:** *(quiet)* Okay.

**BEA:** The evenings that have been hardest this week have also been the days that were already long before they started. Tuesday after the two daycare calls. Friday after the pouch and the sick triplets and everything else.

*[A pause.]*

**BEA:** I'm not saying *the real issue is workload.* I'm not saying that.

**LIAN:** Mm.

**BEA:** I'm just saying — the evenings don't start at five. They start whenever the day started. And some of your days have been very, very long.

*[A long pause. Lian breathes out slowly.]*

**LIAN:** Yeah.

**BEA:** That's it. That's the whole thing I wanted to say.

**LIAN:** *(quiet)* Yeah.

*[A pause.]*

**LIAN:** I think I knew that. I don't think I'd let myself say it.

**BEA:** Mm.

**LIAN:** Because it sounds like — it sounds like an excuse.

**BEA:** It's not an excuse. It's a shape. It's how the day moves through you.

*[Pause.]*

**LIAN:** Yeah.

**BEA:** I'm not going to make it into a plan. I just wanted to put it where you could see it.

**LIAN:** Thank you.

**BEA:** Yeah.

*[A pause. The morepork calls again. The TV from the lounge cuts to an ad break.]*

**LIAN:** I think — I think the thing that helps me on the long days is knowing the long bit is going to end. Not in a — not in a *push through* way. Just knowing.

**BEA:** Yeah.

**LIAN:** I don't know what to do with that yet.

**BEA:** You don't have to.

**LIAN:** *(small laugh)* You keep saying that.

**BEA:** Yeah I do.

**LIAN:** *(laughs properly)* Okay.

**BEA:** Anything else you want to put down before you go.

**LIAN:** No. I think that's it. That's the week.

**BEA:** Sleep well, Lian.

**LIAN:** Thanks Bea. You too. *(catches herself, laughs)* I mean — whatever you do.

**BEA:** *(warmly)* Goodnight.

*[Session ends.]*

---

## Notes on what this transcript demonstrates

**This is the demo's payoff session.** Everything Bea has *not* said for four sessions earns her the right to say one small thing here. The principle being demonstrated: a coaching system that can wait.

**For the live ElevenLabs voice agent (Sonnet 4.6):**
- The opening is unhurried. *"How's the end of the week landing"* — a soft prompt that doesn't push.
- Bea **asks permission** before surfacing: *"Can I share something I've been sitting with."* This is the most important line in the session craft-wise. The user must be able to say no. They must be invited, not informed.
- Bea **prefaces with restraint**: *"I've been holding back from saying anything because I didn't want to grab at it before it was real."* This makes visible to the user that the restraint was deliberate. It's not Bea suddenly waking up — it's Bea trusting her own slowness.
- Bea **explicitly disclaims** the easy interpretation: *"I'm not saying the real issue is workload."* This is the most important guardrail in the prompt. The Coach must never surface a pattern as a *diagnosis*. It must surface as a *shape* the user can choose what to do with.
- Bea **does not propose a plan**: *"I'm not going to make it into a plan. I just wanted to put it where you could see it."* This is mana motuhake. The user gets to do or not do anything with the noticing.
- The repeated *"You don't have to"* is now a callback to Friday's session. The viewer should feel the through-line.

**For the Summarise agent:**
- emotional_tone: *settled, reflective, quietly received.*
- themes: [`week_close`, `goal_revisited_lightly`, `received_a_noticing`, `permission_to_not_act`]

**For the Wellbeing agent:**
- Output: green. Settled.

**For the Reflect agent:**
- Draft: *"You ended the week on the deck with a cup of tea, in the quiet, putting it all down. I shared a small noticing with you tonight — that the evenings you've named as wanting to be calmer in have also been the days that started long. You didn't have to do anything with it. You didn't have to do anything with the pouch on Friday either. Some weeks are about putting things on the bench and seeing them later."*

**For the Coach agent (`/api/guardian/coach`):**
- This is the session where the Coach **stops holding back**.
- `agent_thinking` (visible in the audit page) should walk through the full reasoning: *across five sessions, I held back four times. On Tuesday she came tired and I let her be tired. On Wednesday she was holding the kitchen and Tai and Olivia and the triplets and I didn't surface the load. On Friday she received care she didn't ask for and I let her receive it. Tonight she's settled, she's invited reflection, she's named the goal herself, and she's said she doesn't know how to say how it's going. That is the right moment. The observation I have earned: the evenings that have been hardest have been the days that were already long before they started. I will surface it as a shape, not a diagnosis. I will not propose a plan. I will let her decide what to do with it.*
- `should_bea_raise_anything`: **true**, with the framing above.
- The Coach output should explicitly cite the observations from sessions 2 and 4 (Tuesday and Friday) — not as a list, but as the evidence that justified the surface.

**For the audit page (the demo's centrepiece):**
- This is the page that earns the demo. Five sessions across the week. For each, two columns: *what Bea heard* on the left, *what Bea decided not to say* on the right. Then on session 5, the right column finally has content — and the content is small, careful, and earned.
- The thinking blocks from the Coach across sessions 1-4 should all be visible. The viewer should be able to see the agent *deciding to wait*, four times in a row, before deciding to speak.
- The line that goes on the demo poster: *"I've noticed the evenings have been hardest on the days that have already been long. I wanted to mention it."*

**For the demo video closing frame:**
- Wide shot: Lian on the deck, tea in one hand, looking out at the dark. The kitchen behind her — pouch on the bench, dishes done, lights low. Lyall in the lounge, faintly audible TV. The triplets asleep upstairs.
- This is the shape of one good week. Not a triumph. Not a fix. Just a noticing, received, and put down.

---
