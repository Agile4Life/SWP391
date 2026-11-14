/** Metro shuttle timetable: cruise, brake into the station, dwell, accelerate away. */
export const LOOP = 760;
export const STATION_X = 4;
export const DWELL_S = 7;
export const BRAKE_M = 16;

/** Position along the travel axis (-380..380). */
export function metroPosition(time: number, v: number, stationS: number): number {
  const s0 = -LOOP / 2;
  const tA = (stationS - BRAKE_M - s0) / v;
  const tB = (2 * BRAKE_M) / v;
  const tE = (LOOP / 2 - stationS - BRAKE_M) / v;
  const period = tA + tB + DWELL_S + tB + tE;
  const t = ((time % period) + period) % period;
  if (t < tA) return s0 + v * t;
  if (t < tA + tB) {
    const u = t - tA;
    return stationS - BRAKE_M + v * u - (v / (2 * tB)) * u * u;
  }
  if (t < tA + tB + DWELL_S) return stationS;
  if (t < tA + 2 * tB + DWELL_S) {
    const u = t - tA - tB - DWELL_S;
    return stationS + (v / (2 * tB)) * u * u;
  }
  return stationS + BRAKE_M + v * (t - tA - 2 * tB - DWELL_S);
}

