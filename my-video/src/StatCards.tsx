import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND } from "./brand";

const SPRING_CONFIG = { damping: 100, stiffness: 50, mass: 1 } as const;

const STATS = [
  { number: "18 months", label: "of practice-based research" },
  { number: "5", label: "builds" },
  { number: "167", label: "surveys" },
  { number: "349", label: "coaching sessions" },
  { number: "697", label: "minutes of voice coaching" },
  { number: "59", label: "pilot participants" },
];

const FRAMING_Y = 160;
const STATS_START_Y = 340;
const ROW_HEIGHT = 88;
const NUMBER_COL_X = 600;
const LABEL_COL_X = 1000;

const PHASE2_START = 60;
const STAT_INTERVAL = 36;
const FADE_OUT_START = 270;
const FADE_OUT_END = 300;

export const StatCards: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const framingSpring = spring({ frame, fps, config: SPRING_CONFIG });

  const fadeToWhite = interpolate(
    frame,
    [FADE_OUT_START, FADE_OUT_END],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND.warmMilk,
        fontFamily: BRAND.fontSerif,
        color: BRAND.softCharcoal,
      }}
    >
      {/* Phase 1: framing line */}
      <div
        style={{
          position: "absolute",
          top: FRAMING_Y,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: BRAND.fontDisplay,
          fontSize: 52,
          letterSpacing: "0.02em",
          color: BRAND.softCharcoal,
          opacity: framingSpring,
          transform: `translateY(${interpolate(framingSpring, [0, 1], [10, 0])}px)`,
        }}
      >
        Bea is the fifth build in eighteen months of research.
      </div>

      {/* Phase 2: six stats */}
      {STATS.map((stat, i) => {
        const startFrame = PHASE2_START + i * STAT_INTERVAL;
        const s = spring({
          frame: frame - startFrame,
          fps,
          config: SPRING_CONFIG,
        });
        if (s <= 0.001) return null;
        const y = STATS_START_Y + i * ROW_HEIGHT;
        const translateY = interpolate(s, [0, 1], [10, 0]);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: y,
              left: 0,
              right: 0,
              opacity: s,
              transform: `translateY(${translateY}px)`,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: NUMBER_COL_X,
                top: 0,
                fontFamily: BRAND.fontDisplay,
                fontSize: 64,
                letterSpacing: "0.02em",
                color: BRAND.softCharcoal,
                lineHeight: 1,
              }}
            >
              {stat.number}
            </div>
            <div
              style={{
                position: "absolute",
                left: LABEL_COL_X,
                top: 24,
                fontFamily: BRAND.fontSerif,
                fontSize: 28,
                color: BRAND.softCharcoal,
                opacity: 0.7,
              }}
            >
              {stat.label}
            </div>
          </div>
        );
      })}

      {/* Final fade to white */}
      {fadeToWhite > 0 && (
        <AbsoluteFill
          style={{ backgroundColor: "#ffffff", opacity: fadeToWhite }}
        />
      )}
    </AbsoluteFill>
  );
};
