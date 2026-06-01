// Lab series shaping lives in @peptide/shared (client-safe, shared with mobile).
// Re-exported here so existing web imports of "@/lib/labs-shape" keep working.
export {
  shapeLabSeries,
  formatLabValue,
  type LabReadingRow,
  type MarkerSeries,
} from "@peptide/shared/labs/shape";
