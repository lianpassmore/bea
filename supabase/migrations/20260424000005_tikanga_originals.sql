-- Guardian 7 (Tikanga) audit trail
-- When a draft fails the ten-pou check and is replaced by tikanga_rewrite,
-- the original draft is preserved alongside the rewrite for review.
-- check_ins.reflection_original: the pre-tikanga reflection (text)
-- family_insights.insight_original: the pre-tikanga InsightOutput object (jsonb)

ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS reflection_original text;
ALTER TABLE family_insights ADD COLUMN IF NOT EXISTS insight_original jsonb;
