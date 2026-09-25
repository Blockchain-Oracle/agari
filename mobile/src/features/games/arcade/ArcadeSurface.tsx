import { FIELD_H, FIELD_W } from "@agari/core/games/arcade";
import { useImperativeHandle, useState, type Ref } from "react";
import { StyleSheet } from "react-native";
import Svg, { Defs, Path, RadialGradient } from "react-native-svg";
import { Stop, stopPaint } from "~/components/ui/SvgStop";
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

/**
 * `fit`: the full-screen stage shows the whole field, centred, as large as its band allows; `x0` trims field units
 * off the left edge, behind the player. The page's 16:9 screen fills exactly, as web's canvas does.
 */
export function ArcadeSurface({ ref, fit = false, x0 = 0 }: { ref: Ref<SurfaceHandle>; fit?: boolean; x0?: number }) {
  const [frame, setFrame] = useState<Frame>(EMPTY);
  useImperativeHandle(ref, () => ({ paint: setFrame }), []);

  return (
    <Svg
      style={StyleSheet.absoluteFill}
      viewBox={`${x0} 0 ${FIELD_W - x0} ${FIELD_H}`}
      preserveAspectRatio={fit ? "xMidYMid meet" : "xMinYMin slice"}
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
                  {...stopPaint(stop.color, stop.opacity)}
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
