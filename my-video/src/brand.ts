import { loadFont as loadLora } from "@remotion/google-fonts/Lora";
import { loadFont as loadDMSerifDisplay } from "@remotion/google-fonts/DMSerifDisplay";

const lora = loadLora("normal", { weights: ["400", "500", "600", "700"] });
const loraItalic = loadLora("italic", { weights: ["400"] });
const dmSerifDisplay = loadDMSerifDisplay("normal", { weights: ["400"] });

export const BRAND = {
  warmMilk: "#F5F1E8",
  kitchenAmber: "#D6A85A",
  softCharcoal: "#2F2F2F",
  fontSerif: `${lora.fontFamily}, Georgia, serif`,
  fontDisplay: `${dmSerifDisplay.fontFamily}, Georgia, serif`,
} as const;

export const VIDEO = {
  width: 1920,
  height: 1080,
  fps: 30,
} as const;

export const waitForFonts = () =>
  Promise.all([
    lora.waitUntilDone(),
    loraItalic.waitUntilDone(),
    dmSerifDisplay.waitUntilDone(),
  ]);
