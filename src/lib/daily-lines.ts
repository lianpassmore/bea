export const DAILY_LINES = [
  // Permission and acceptance
  "You don't have to have it figured out today.",
  "You don't have to earn rest.",
  "You're allowed to change your mind.",
  "You're allowed to not be okay.",
  "You're allowed to start again. As many times as you need.",
  "Not knowing yet is a real and useful answer.",
  "You don't have to be grateful right now.",
  "The day doesn't have to be good for you to be okay.",
  "You can hold two true things at once.",
  "You don't owe anyone your strength.",

  // Self-recognition
  'The version of you that shows up is enough.',
  "Most days, you're doing better than you think.",
  "Whatever you're carrying — it's heavier than it looks from the outside.",
  'Tired is information, not a verdict.',
  "What you noticed about yourself today, you didn't know yesterday.",
  'Being honest with yourself is a quiet kind of courage.',
  'Slow is a kind of strength.',
  "The pace you're moving is the right pace for now.",
  'Small kindnesses to yourself count.',
  'The way you talk to yourself matters more than you think.',

  // Change and the practice
  "Insight isn't change. The repeating is the change.",
  '1% better is enough.',
  "One thing at a time. That's enough.",
  'Small, repeated, patient.',
  "The first step doesn't have to be a big one.",
  'Most lasting change is quiet.',
  'Falling off the wagon is part of being on it.',
  'Done badly is still done.',
  "The path bends. That's normal.",
  "You don't have to fix it all today.",
  'What you focus on, you give air to.',

  // Hard days
  'Hard days are still days.',
  'Some days the win is just getting through.',
  "Heavy is heavy. You don't have to make it lighter than it is.",
  'The hardest moments are rarely the ones that define you.',
  "It's okay to come back when there's nothing to say.",
  'Saying it out loud changes it.',
  'What gets seen, gets softer.',
  "You don't have to carry it in silence.",
  'Naming a thing makes it less heavy.',
  "The thing that scares you is usually less scary once it's spoken.",

  // Lighter days
  'A good day is data too.',
  "Pay attention to what worked. That's where the learning is.",
  "Joy doesn't have to be loud to count.",
  "Notice what's been good. It tells you something.",
  'The fact that this got easier is worth noticing.',
]

export function getDailyLine(date: Date = new Date()): string {
  const start = new Date(date.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86_400_000)
  return DAILY_LINES[dayOfYear % DAILY_LINES.length]
}
