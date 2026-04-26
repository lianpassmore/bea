import { AbsoluteFill } from "remotion";
import { BRAND } from "./brand";

export const MyComposition = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND.warmMilk,
        color: BRAND.softCharcoal,
        fontFamily: BRAND.fontSerif,
      }}
    />
  );
};
