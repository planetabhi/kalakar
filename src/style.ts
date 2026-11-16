import { Hand } from './internal/hand.js';

export type PigmentStyle = 'none' | 'solid' | 'hachure' | 'crosshatch';

/** User-facing options controlling the hand-drawn look. All fields optional. */
export interface Style {
  /** How loose/rough the linework is. 0 = exact. Default 1. */
  looseness?: number;
  /** How much straight lines bow/curve. Default 1. */
  waver?: number;
  /** Maximum random point offset in px. Default 2. */
  maxJitter?: number;
  /** Deterministic seed for the Hand. 0 or undefined = non-deterministic. */
  seed?: number;
  /** Outline color (SVG-native). Default '#000'. */
  stroke?: string;
  /** Outline width in px (SVG-native). Default 1. */
  strokeWidth?: number;
  /** Disable the double/multi stroke effect. Default false. */
  singlePass?: boolean;
  /** Keep endpoints exact while jittering the rest of the line. Default false. */
  pinVertices?: boolean;
  /** Fill color (SVG-native; the Pigment color). */
  fill?: string;
  /** Fill style: 'none', 'solid', 'hachure', or 'crosshatch'. Default 'none'. */
  pigmentStyle?: PigmentStyle;
  /** Extra looseness added to a solid pigment pass. Default 0.8. */
  pigmentRoughnessGain?: number;
  /** Angle of hachure/crosshatch fill lines in degrees. Default -41. */
  hatchAngle?: number;
  /** Gap between hachure/crosshatch lines in px. -1 = auto (pigmentWidth x 4). Default -1. */
  hatchGap?: number;
  /** Width of hachure/crosshatch lines in px. -1 = auto (strokeWidth / 2). Default -1. */
  pigmentWidth?: number;
  /** Disable the double/multi stroke on hachure/crosshatch lines. Default false. */
  pigmentSinglePass?: boolean;
  /** Round output coordinates to this many decimal places. Default off. */
  fixedDecimals?: number;
}

/** Fully-resolved style used internally by the engine. */
export interface ResolvedStyle {
  looseness: number;
  waver: number;
  maxJitter: number;
  seed: number;
  stroke: string;
  strokeWidth: number;
  singlePass: boolean;
  pinVertices: boolean;
  fill?: string;
  pigmentStyle: PigmentStyle;
  pigmentRoughnessGain: number;
  hatchAngle: number;
  hatchGap: number;
  pigmentWidth: number;
  pigmentSinglePass: boolean;
  fixedDecimals?: number;
  /** Transient seeded source, lazily created during rendering. */
  hand?: Hand;
}

export const DEFAULT_STYLE: ResolvedStyle = {
  looseness: 1,
  waver: 1,
  maxJitter: 2,
  seed: 0,
  stroke: '#000',
  strokeWidth: 1,
  singlePass: false,
  pinVertices: false,
  pigmentStyle: 'none',
  pigmentRoughnessGain: 0.8,
  hatchAngle: -41,
  hatchGap: -1,
  pigmentWidth: -1,
  pigmentSinglePass: false,
};

/** Merge a user Style over the defaults into a ResolvedStyle. */
export function resolveStyle(style?: Style): ResolvedStyle {
  return style ? { ...DEFAULT_STYLE, ...style } : { ...DEFAULT_STYLE };
}
