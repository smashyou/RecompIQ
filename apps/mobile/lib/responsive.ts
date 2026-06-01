import { useWindowDimensions } from "react-native";

// Shared responsive scale for RN — the mobile mirror of the web fluid scale.
// RN has no clamp(), so we use mobile-first values that bump a step on tablet.
// Names match the web type/space scale so the two surfaces stay in parity.
//
// Usage:  const { type, space, isTablet } = useResponsive();
//         <Text style={{ fontSize: type.stat }}>…</Text>
//         <Content style={{ paddingHorizontal: space.page }}>

const TABLET_MIN = 700; // pt — iPad / large foldable

export interface TypeScale {
  "2xs": number; xs: number; sm: number; base: number; lg: number; xl: number;
  "2xl": number; "3xl": number; metric: number; stat: number; display: number;
}
export interface SpaceScale {
  page: number; pagey: number; grid: number; card: number; section: number;
}

const TYPE_PHONE: TypeScale = {
  "2xs": 10, xs: 11, sm: 13, base: 14.5, lg: 16, xl: 19,
  "2xl": 22, "3xl": 27, metric: 24, stat: 28, display: 34,
};
const TYPE_TABLET: TypeScale = {
  "2xs": 11, xs: 12.5, sm: 14.5, base: 16, lg: 18, xl: 22,
  "2xl": 26, "3xl": 33, metric: 28, stat: 34, display: 44,
};

const SPACE_PHONE: SpaceScale = { page: 16, pagey: 12, grid: 12, card: 16, section: 20 };
const SPACE_TABLET: SpaceScale = { page: 28, pagey: 20, grid: 16, card: 20, section: 28 };

export interface Responsive {
  width: number;
  isTablet: boolean;
  type: TypeScale;
  space: SpaceScale;
}

export function useResponsive(): Responsive {
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_MIN;
  return {
    width,
    isTablet,
    type: isTablet ? TYPE_TABLET : TYPE_PHONE,
    space: isTablet ? SPACE_TABLET : SPACE_PHONE,
  };
}

// Non-hook access for module scope / quick reads (phone scale).
export const type = TYPE_PHONE;
export const space = SPACE_PHONE;
