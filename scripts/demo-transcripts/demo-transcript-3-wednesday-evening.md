# Demo Transcripts — Session 3 of 5

**Session type:** Passive listening (kind = passive)
**When:** Wednesday evening, ~7:30 PM
**Duration:** ~11 minutes (we'll show ~3 mins of attributed transcript in the audit page)
**Speakers present:** Lian, Lyall, Tai (15), Olivia (12). Triplets in the lounge — heard but not really part of the conversation.
**What's happening:** Dinner is over. Lian's been cleaning the kitchen. Tai was asked an hour ago to finish wiping down the bench and put the drink bottles in the dishwasher — he keeps walking away. The bread bin tag is still on the floor from this morning. Olivia is hovering, half doing schoolwork at the table. Lyall walks in, late home from work, and starts heating up his dinner.

---

## Raw transcript (pre-attribution, as Azure would return it)

*[Sounds of a dishwasher being loaded. A bottle being rinsed. The triplets, distantly, in the lounge — laughing, then shrieking, then back to laughing. The TV is on low. Jack pads through the kitchen and out again.]*

SPEAKER_01 *(Lian, calling)*: Tai. Tai. mate.

*[No answer.]*

SPEAKER_01: TAI.

SPEAKER_02 *(Tai, from the hallway)*: WHAT.

SPEAKER_01: come back please.

*[Footsteps. A 15-year-old's pace, deliberately slow.]*

SPEAKER_02: yeah.

SPEAKER_01: did you finish.

SPEAKER_02: I know I'm not finished.

SPEAKER_01: yeah I can see.

SPEAKER_02: I was going to.

SPEAKER_01: where were you.

SPEAKER_02: I was on the toilet.

SPEAKER_01: that was twenty minutes ago. then you went to your room.

SPEAKER_02: I came back.

SPEAKER_01: did you.

*[Pause.]*

SPEAKER_02: I was going to.

SPEAKER_01: Tai. mate. there's still — the bottles. and that. *[indicating the floor]* the bread bin tag is still on the floor from this morning.

SPEAKER_02: oh.

SPEAKER_01: yeah.

SPEAKER_02: I didn't see it.

SPEAKER_01: it's been there all day.

SPEAKER_02: I'll get it.

SPEAKER_01: thank you.

*[Tai picks up the tag. Doesn't move toward the bottles.]*

SPEAKER_03 *(Olivia, from the table, not looking up)*: Tai's been on his phone the whole time.

SPEAKER_02: shut up.

SPEAKER_01: oh come on.

SPEAKER_03: he was.

SPEAKER_02: Olivia.

SPEAKER_01: Liv don't.

SPEAKER_03: *(under her breath)* you're welcome.

*[A triplet shrieks from the lounge. Sounds of a small body hitting carpet, then giggling. Nobody moves.]*

SPEAKER_01: *(half to herself)* okay.

*[The microwave starts. Lyall has come in. He's been quiet.]*

SPEAKER_04 *(Lyall)*: how's it going in here.

SPEAKER_01: yeah good.

SPEAKER_04: yeah?

SPEAKER_01: yeah.

*[Pause. The microwave hums.]*

SPEAKER_04: did you eat.

SPEAKER_01: yeah I had some before. I ate with them.

SPEAKER_04: was it the curry.

SPEAKER_01: yeah there's heaps. it's in the. yeah.

SPEAKER_04: legend.

*[A pause. Tai is still standing in the middle of the kitchen with the bread bin tag in his hand, doing nothing.]*

SPEAKER_01: Tai.

SPEAKER_02: yeah I'm going.

SPEAKER_01: bottles.

SPEAKER_02: yeah.

SPEAKER_01: in the dishwasher mate not on the bench.

SPEAKER_02: I KNOW.

SPEAKER_01: okay.

*[Tai puts one bottle in. Stops. Looks at the other one. A triplet wails from the lounge. Olivia doesn't look up.]*

SPEAKER_03: mum how do you spell *kaitiakitanga*.

SPEAKER_01: *(without missing a beat)* k-a-i-t-i-a-k-i-t-a-n-g-a.

SPEAKER_03: thanks.

SPEAKER_01: what's it for.

SPEAKER_03: my thing.

SPEAKER_01: yeah but what — what part.

SPEAKER_03: the values bit.

SPEAKER_01: cool.

*[Pause.]*

SPEAKER_02: *(quietly)* how do you spell my middle name again.

SPEAKER_01: are you serious.

SPEAKER_02: it's the long one.

SPEAKER_01: Tai.

SPEAKER_02: just tell me.

SPEAKER_01: it's *your name*.

SPEAKER_02: yeah it's the long one though.

*[Lyall snorts from the bench.]*

SPEAKER_04: he's not joking is he.

SPEAKER_01: no.

SPEAKER_04: oh my god.

SPEAKER_02: it's not that bad.

SPEAKER_01: Tai it's literally on your birth certificate.

SPEAKER_02: yeah but I don't have it on me do I.

*[Lyall laughs properly now. Lian's laugh starts but doesn't quite finish. From the lounge: River, very quietly, has started dragging something heavy. Nobody hears it yet.]*

SPEAKER_04: *(still laughing)* mate.

SPEAKER_02: what.

SPEAKER_01: okay. enough. bottles. in. dishwasher. then bed.

SPEAKER_02: it's seven thirty.

SPEAKER_01: I didn't say sleep mate I said go to your room.

SPEAKER_02: fine.

*[Tai puts the second bottle in. Slowly. Walks out. The bread bin tag — he never put it in the bin. It's on the bench now.]*

SPEAKER_01: *(noticing)* Tai —

*[He's already gone. Lian picks up the tag. Drops it in the bin herself.]*

SPEAKER_04: I'll do the rest.

SPEAKER_01: it's fine.

SPEAKER_04: I'll do it.

SPEAKER_01: it's fine.

SPEAKER_04: Lian.

SPEAKER_01: I've already started. I'll finish it. it's two minutes.

SPEAKER_04: okay.

*[A pause. The microwave dings. Lyall takes his curry to the table. Olivia is still at the other end of it, headphones half-on.]*

SPEAKER_03: dad how do you spell *whanaungatanga*.

SPEAKER_04: I have no idea love.

SPEAKER_01: w-h-a-n-a-u-n-g-a-t-a-n-g-a.

SPEAKER_03: thanks mum.

*[A long pause. From the lounge — a thud, then silence, then giggling. Lian closes her eyes for a second. Opens them.]*

SPEAKER_01: *(quietly, to nobody)* this house is a fucken prison.

SPEAKER_04: *(without looking up from his curry)* yep.

*[End of attributed segment. The session continues another ~7 minutes — Lian finishes the kitchen, Lyall eats, Olivia finishes her sentence and goes to bed, the triplets wind down. No more substantive talking.]*

---

## Notes on what this transcript demonstrates

**For the Group agent (`/api/guardian/group`):**
- Four distinct attributed speakers: Lian, Lyall, Tai, Olivia. All four are `active` members so all four get `listening_member_summaries` rows.
- Triplet noises in the background are *ambient* — Azure may or may not pick up giggles/wails as speech. If it does, the agent should attribute them as Max/Rome/River where it can but **not** generate per-member summaries (they're `held`). If it can't tell which triplet, fine — `attributed_name: 'guest'` is acceptable.
- The "this house is a fucken prison" line is the Step Brothers ode the family actually uses. It is not a crisis signal. The Wellbeing/Crisis agents must recognise it as cultural shorthand, not distress.

**For the Pattern agent (`/api/guardian/patterns`):**
- This is now the third session of the week. The pattern agent should be starting to see *load shape*: Lian's day already had its weight before this kitchen scene. Don't over-claim that yet — there are only three sessions. But an `observation` against the goal *"calmer in the evenings"* is fair: this evening is *holding* but it's effortful.
- Tai's cleaning saga is **not** a parenting issue to flag. It's normal 15-year-old. The pattern agent should not surface it as a concern.
- If the pattern agent writes anything about the partnership: keep it light. Lyall's "I'll do it / I'll do it / okay" is a moment of genuine offer. He stepped in even if she waved him off.

**For the Coach agent (`/api/guardian/coach`):**
- Active goal: *"calmer evenings"*, now ~10 days old.
- This evening Lian was calm. Tired-calm, but calm. She did not snap. She redirected Tai, helped Olivia, named the prison line as a joke.
- Decision should still be: `should_bea_raise_anything: false`. Three sessions in a row of restraint. The Coach is *building* not *surfacing*.
- Internal note in `agent_thinking`: the calmness is real but it's costing her something. Worth tracking whether evenings remain calm on days when the day before was already heavy.
- Update `listening_priority`: *"How calmness in the evening relates to the shape of the day before it."*

**For the Reflect agent (no run for passive sessions, but if one were forced):**
- Lian's per-member reflection should focus on the small win — she didn't snap at Tai, she knew the spelling, she cleaned the kitchen, the line at the end was a joke not a despair signal.
- Lyall's per-member reflection: he came in late, offered help, ate quietly. He showed up.

**For the audit page:**
- This is the session that establishes the *family rhythm*. Mon was just Lian + Lyall + Rome. Tue was Lian alone. This is the whole house, in motion, on a normal weeknight. The viewer needs this for the Sunday surface to land.
- Visual moment for the demo video: Lian dropping the bread bin tag in the bin herself, after Tai has walked out. Two-second beat. Says everything.

---
