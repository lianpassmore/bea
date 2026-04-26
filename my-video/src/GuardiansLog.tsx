import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND } from "./brand";

const TS_X = 420;
const LABEL_X = 640;
const DESC_X = 1080;
const BLOCK_END_X = 1500;

const HEADER_Y = 130;
const DIVIDER_Y = 188;
const LINE_START_Y = 240;
const LINE_GAP = 46;
const COACH_GAP_EXTRA = 18;
const CLOSING_GAP_AFTER_COACH = 76;
const CLOSING_GAP = 52;

const PHASE2_START = 120;
const PHASE3_START = 210;
const LINE_INTERVAL = 36;
const PHASE4_START = 660;
const PHASE5_START = 780;

const SPRING_CONFIG = { damping: 100, stiffness: 40, mass: 1 } as const;

type Agent = {
  ts: string;
  label: string;
  desc: string;
  amber?: boolean;
};

const AGENTS: Agent[] = [
  { ts: "18:47:03", label: "Summarise", desc: "writing the structured summary" },
  { ts: "18:47:04", label: "Context", desc: "reading the household memory" },
  { ts: "18:47:04", label: "Wellbeing", desc: "classifying green / amber / red" },
  { ts: "18:47:05", label: "Reflect", desc: "drafting Bea's reflection" },
  {
    ts: "18:47:06",
    label: "Tikanga",
    desc: "validating against ten cultural pou",
    amber: true,
  },
  { ts: "18:47:07", label: "Silence", desc: "deciding whether to speak at all" },
  { ts: "18:47:08", label: "Absence", desc: "noticing what went quiet" },
  {
    ts: "18:47:09",
    label: "Crisis",
    desc: "checking for distress signals",
    amber: true,
  },
  {
    ts: "18:47:10",
    label: "Insight",
    desc: "reading the family's pulse",
    amber: true,
  },
  { ts: "18:47:11", label: "Perspective", desc: "hearing it from each member" },
  {
    ts: "18:47:12",
    label: "Pattern Detection",
    desc: "finding what keeps recurring",
    amber: true,
  },
];

const COACH_LINE = {
  ts: "18:47:13",
  label: "Coach",
  desc: "Opus 4.7 · xhigh effort · extended thinking",
};

const CLOSING_LINES = [
  "Coach considered 7 alternatives.",
  "Persisted 6 to the audit trail.",
  "Will surface 1 — gently — at the next conversation.",
];

export const GuardiansLog: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phase1Spring = spring({ frame, fps, config: SPRING_CONFIG });
  const phase1Out = interpolate(frame, [90, 120], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const phase1Opacity = phase1Spring * phase1Out;

  const phase2Spring = spring({
    frame: frame - PHASE2_START,
    fps,
    config: SPRING_CONFIG,
  });
  const dividerSpring = spring({
    frame: frame - PHASE2_START - 15,
    fps,
    config: SPRING_CONFIG,
  });

  const coachSpring = spring({
    frame: frame - PHASE4_START - 30,
    fps,
    config: SPRING_CONFIG,
  });

  const amberMix = interpolate(
    frame,
    [PHASE4_START, PHASE4_START + 45],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const fadeToWhite = interpolate(frame, [870, 900], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const coachY = LINE_START_Y + AGENTS.length * LINE_GAP + COACH_GAP_EXTRA;
  const closingStartY = coachY + CLOSING_GAP_AFTER_COACH;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND.warmMilk,
        fontFamily: BRAND.fontSerif,
        color: BRAND.softCharcoal,
      }}
    >
      {/* Phase 1: centered intro */}
      {phase1Opacity > 0.001 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            opacity: phase1Opacity,
            gap: 28,
          }}
        >
          <div
            style={{
              fontFamily: BRAND.fontDisplay,
              fontSize: 96,
              letterSpacing: "0.04em",
              color: BRAND.softCharcoal,
            }}
          >
            18:47
          </div>
          <div
            style={{
              fontFamily: BRAND.fontDisplay,
              fontSize: 48,
              letterSpacing: "0.02em",
            }}
          >
            Conversation ends.
          </div>
          <div
            style={{
              fontFamily: BRAND.fontSerif,
              fontSize: 24,
              color: BRAND.softCharcoal,
              opacity: 0.6,
              marginTop: 16,
            }}
          >
            Lian · 1:1 check-in · 14 minutes
          </div>
        </div>
      )}

      {/* Phase 2: handoff header + amber divider */}
      {frame >= PHASE2_START && (
        <>
          <div
            style={{
              position: "absolute",
              left: TS_X,
              top: HEADER_Y,
              fontFamily: BRAND.fontSerif,
              fontStyle: "italic",
              fontSize: 26,
              color: BRAND.softCharcoal,
              opacity: phase2Spring * 0.85,
              transform: `translateY(${interpolate(phase2Spring, [0, 1], [8, 0])}px)`,
            }}
          >
            18:47:02 — handing off to guardians...
          </div>
          <div
            style={{
              position: "absolute",
              left: TS_X,
              top: DIVIDER_Y,
              width: (BLOCK_END_X - TS_X) * dividerSpring,
              height: 1,
              backgroundColor: BRAND.kitchenAmber,
              opacity: 0.9,
            }}
          />
        </>
      )}

      {/* Phase 3 + 4: log lines */}
      {AGENTS.map((agent, i) => {
        const startFrame = PHASE3_START + i * LINE_INTERVAL;
        const lineSpring = spring({
          frame: frame - startFrame,
          fps,
          config: SPRING_CONFIG,
        });
        if (lineSpring <= 0.001) return null;
        const y = LINE_START_Y + i * LINE_GAP;
        const translateY = interpolate(lineSpring, [0, 1], [10, 0]);
        const color = agent.amber
          ? mixColor(BRAND.softCharcoal, BRAND.kitchenAmber, amberMix)
          : BRAND.softCharcoal;
        return (
          <LogLine
            key={i}
            y={y}
            opacity={lineSpring}
            translateY={translateY}
            ts={agent.ts}
            label={agent.label}
            desc={agent.desc}
            color={color}
          />
        );
      })}

      {/* Phase 4: Coach line appended */}
      {coachSpring > 0.001 && (
        <LogLine
          y={coachY}
          opacity={coachSpring}
          translateY={interpolate(coachSpring, [0, 1], [10, 0])}
          ts={COACH_LINE.ts}
          label={COACH_LINE.label}
          desc={COACH_LINE.desc}
          color={BRAND.kitchenAmber}
        />
      )}

      {/* Phase 5: closing lines */}
      {CLOSING_LINES.map((line, i) => {
        const startFrame = PHASE5_START + i * 30;
        const lineSpring = spring({
          frame: frame - startFrame,
          fps,
          config: SPRING_CONFIG,
        });
        if (lineSpring <= 0.001) return null;
        const y = closingStartY + i * CLOSING_GAP;
        const translateY = interpolate(lineSpring, [0, 1], [10, 0]);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: TS_X,
              top: y,
              width: BLOCK_END_X - TS_X,
              fontFamily: BRAND.fontSerif,
              fontStyle: "italic",
              fontSize: 26,
              color: BRAND.softCharcoal,
              opacity: lineSpring,
              transform: `translateY(${translateY}px)`,
            }}
          >
            {line}
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

const LogLine: React.FC<{
  y: number;
  opacity: number;
  translateY: number;
  ts: string;
  label: string;
  desc: string;
  color: string;
}> = ({ y, opacity, translateY, ts, label, desc, color }) => {
  return (
    <div
      style={{
        position: "absolute",
        top: y,
        left: 0,
        right: 0,
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: TS_X,
          top: 6,
          fontFamily: BRAND.fontSerif,
          fontSize: 22,
          color: BRAND.softCharcoal,
          opacity: 0.6,
        }}
      >
        {ts}
      </div>
      <div
        style={{
          position: "absolute",
          left: LABEL_X,
          top: -4,
          fontFamily: BRAND.fontDisplay,
          fontSize: 32,
          letterSpacing: "0.04em",
          color,
        }}
      >
        {label}
      </div>
      <div
        style={{
          position: "absolute",
          left: DESC_X,
          top: 4,
          fontFamily: BRAND.fontSerif,
          fontStyle: "italic",
          fontSize: 24,
          color,
        }}
      >
        {desc}
      </div>
    </div>
  );
};

function mixColor(a: string, b: string, t: number): string {
  const parse = (h: string) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const mix = (x: number, y: number) => Math.round(x + (y - x) * t);
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${hex(mix(ar, br))}${hex(mix(ag, bg))}${hex(mix(ab, bb))}`;
}
