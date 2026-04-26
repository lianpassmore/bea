import "./index.css";
import { Composition } from "remotion";
import { MyComposition } from "./Composition";
import { GuardiansLog } from "./GuardiansLog";
import { StatCards } from "./StatCards";
import { VIDEO } from "./brand";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MyComp"
        component={MyComposition}
        durationInFrames={60}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
      />
      <Composition
        id="GuardiansLog"
        component={GuardiansLog}
        durationInFrames={900}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
      />
      <Composition
        id="StatCards"
        component={StatCards}
        durationInFrames={300}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
      />
    </>
  );
};
