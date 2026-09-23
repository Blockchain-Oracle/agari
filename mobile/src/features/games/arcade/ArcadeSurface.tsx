import { FIELD_H, FIELD_W } from "@agari/core/games/arcade";
import { useImperativeHandle, useState, type Ref } from "react";
import { StyleSheet } from "react-native";
import Svg, { Defs, Path, RadialGradient, Stop } from "react-native-svg";
import type { Frame } from "./recorder";

/**
 * The phone's `<canvas className="ar-canvas">`: one SVG over the fixed 640×360 field, painting whatever frame
 * the loop recorded last. The field's scale is the viewBox's job, so the draw code stays in field units as it
 * is on web. It is imperative on purpose — the loop calls `paint(frame)` and nothing above it re-renders.
 */
export interface SurfaceHandle {
  paint(frame: Frame): void;
}

const EMPTY: Frame = { ops: [], gradients: [] };

export function ArcadeSurface({ ref }: { ref: Ref<SurfaceHandle> }) {
  const [frame, setFrame] = useState<Frame>(EMPTY);
  useImperativeHandle(ref, () => ({ paint: setFrame }), []);

  return (
    <Svg
      style={StyleSheet.absoluteFill}
      viewBox={`0 0 ${FIELD_W} ${FIELD_H}`}
      preserveAspectRatio="xMinYMin slice"
      pointerEvents="none"
    >
      {frame.gradients.length > 0 ? (
        <Defs>
          {frame.gradients.map((g) => (
            <RadialGradient
              key={g.id}
              id={g.id}
              cx={g.cx}
              cy={g.cy}
              r={g.r}
              fx={g.cx}
              fy={g.cy}
              gradientUnits="userSpaceOnUse"
            >
              {g.stops.map((stop, i) => (
                <Stop
                  key={i}
                  offset={stop.offset}
                  stopColor={stop.color}
                  stopOpacity={stop.opacity}
                />
              ))}
            </RadialGradient>
          ))}
        </Defs>
      ) : null}
      {frame.ops.map((op, i) =>
        op.fill !== null ? (
          <Path
            key={i}
            d={op.d}
            fill={op.fill}
            fillOpacity={op.opacity}
          />
        ) : (
          <Path
            key={i}
            d={op.d}
            fill="none"
            stroke={op.stroke ?? undefined}
            strokeOpacity={op.opacity}
            strokeWidth={op.width}
            strokeLinecap={op.cap}
            strokeLinejoin={op.join}
          />
        ),
      )}
    </Svg>
  );
}
