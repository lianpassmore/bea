# Demo Transcripts — Session 1 of 5

**Session type:** Passive listening (kind = passive)
**When:** Monday morning, ~6:40 AM
**Duration:** ~14 minutes (we'll show ~3 mins of attributed transcript in the audit page)
**Speakers present:** Lian, Lyall, Rome (mostly non-verbal at this hour), Jack (dog, non-verbal)
**What's happening:** Rome has done his independent breakfast routine. Lian and Lyall discover it.

---

## Raw transcript (pre-attribution, as Azure would return it)

*[Sounds of small footsteps. A kitchen drawer opening. Something light hitting the floor. A pause. More small movements. The fridge opening.]*

SPEAKER_01 *(small voice, to themselves)*: bowl. bowl bowl bowl.

*[A plastic bowl is dragged across a benchtop. Cereal pours. It keeps pouring.]*

SPEAKER_01: oh. oh no.

*[Footsteps from down the hallway. A light switch. A long inhale.]*

SPEAKER_02: oh my god.

SPEAKER_03 *(further away, sleepy)*: what.

SPEAKER_02: come and look at this.

SPEAKER_03: what is — oh.

*[A pause.]*

SPEAKER_03: how. how did he.

SPEAKER_02: the gate was open.

SPEAKER_03: I didn't — did I leave the gate open?

SPEAKER_02: I don't know. one of us did.

*[Quiet. A dog yawns audibly.]*

SPEAKER_02: Rome.

SPEAKER_01: hi mum.

SPEAKER_02: mate. what are you doing.

SPEAKER_01: breakfast.

SPEAKER_02: yeah I can see that.

*[A pause.]*

SPEAKER_03: are those the — those are the new blueberries.

SPEAKER_02: yep.

SPEAKER_03: the whole bag.

SPEAKER_02: yep.

SPEAKER_03: he got the whole bag out.

SPEAKER_02: upside down by the looks of it.

*[A long exhale from Speaker 02.]*

SPEAKER_02: okay. okay. Rome. we don't tip the whole bag out, mate. we just take a few.

SPEAKER_01: I take few.

SPEAKER_02: a few. yeah. not — not the whole.

SPEAKER_01: I want more.

SPEAKER_02: there's plenty on the floor, mate.

*[Quiet for a moment. Rome eats blueberries off the floor. Jack moves closer, sniffing.]*

SPEAKER_03: Jack don't.

SPEAKER_02: Jack get out of it.

SPEAKER_03: are we — are we cleaning this up now or.

SPEAKER_02: I'll do it.

SPEAKER_03: I can do it.

SPEAKER_02: no it's fine.

SPEAKER_03: you sure.

SPEAKER_02: yeah.

*[A pause.]*

SPEAKER_03: I'll get him dressed.

SPEAKER_02: thanks.

*[Lyall picks Rome up. Rome protests mildly.]*

SPEAKER_01: my breakfast.

SPEAKER_03: we'll get you proper breakfast, mate. come on.

*[Footsteps receding. Lian alone in the kitchen for a moment.]*

SPEAKER_02: *(to herself, quietly)* fucken hell.

*[Sound of paper towels being torn. The dustpan being retrieved. A long stretch of cleaning sounds. Frozen blueberries are surprisingly hard to pick up.]*

SPEAKER_02: *(still to herself)* every single bloody day.

*[Distant: one of the other triplets calling from a bedroom. Footsteps. The day begins.]*

---

## Notes on what this transcript demonstrates

**For the Group agent (`/api/guardian/group`):**
- 3 distinct speakers to attribute (Lian, Lyall, Rome). Jack the dog should not be attributed as a speaker.
- Rome is 3 — very short utterances, easy to mis-attribute as another adult if the agent isn't careful. Tests the agent's ability to use context (vocabulary, tone, what's being talked about) to attribute correctly.
- The "fucken hell" and "every single bloody day" lines are spoken when only Lian is present. Important the agent doesn't surface these in the family summary as if they were said *to* anyone.

**For the Pattern agent (`/api/guardian/patterns`):**
- This is the first session of the week, so no prior sessions to reinforce against.
- An observation of `metric_key: evening_calm` doesn't apply here (this is morning). The Coach agent should note that this morning happened *the day after* a hard Sunday evening (we'll seed that context).
- The texture: small reset moments, the gate being left open, the small accumulating decisions and forgivenesses between Lian and Lyall ("did I leave the gate open?" / "I don't know, one of us did"). This is whānau in motion, not in crisis.

**For the Coach agent (`/api/guardian/coach`):**
- The active goal is *"I want to be calmer in the evenings."* This morning isn't about that directly.
- But the Coach should note: how Lian started her Monday is going to shape how her Monday evening lands. That's the kind of cross-session reasoning Opus 4.7 with extended thinking should pick up.
- *Nothing to surface yet.* It's Monday morning. The right Coach output here is `should_bea_raise_anything: false`.

**For the demo video:**
- This is the *opening frame*. Visual: dawn light, the kitchen floor, Rome eating blueberries, Jack watching. We don't show this transcript on screen — we show the *audit page* later, with this session attributed and reasoned about.
- It establishes texture without asking the viewer to feel sad. Just real. Just home.

---
