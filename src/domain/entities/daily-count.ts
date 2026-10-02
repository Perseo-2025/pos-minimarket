import type { CaptureSource } from "../value-objects/capture-source";
import type { CountedLot } from "../services/expiry";
import type { CountCandidate, CountReason } from "../services/daily-count";

// A product the system proposes to count today at a location.
export interface CountCandidateRow {
  candidate: CountCandidate;
  productName: string;
  categoryName: string;
  tracksExpiry: boolean;
  // Dates already known there (quantities are never shown to who counts).
  lotDates: string[];
}

export interface DailyCountProduct {
  productId: number;
  productName: string;
  categoryName: string;
  tracksExpiry: boolean;
  lotDates: string[];
  reasons: CountReason[];
}

export type CountItemStatus = "matched" | "pending" | "approved" | "rejected";

export const COUNT_ITEM_STATUS_LABELS: Record<CountItemStatus, string> = {
  matched: "Coincidió",
  pending: "Por revisar",
  approved: "Ajuste aprobado",
  rejected: "Se pidió recontar",
};

export interface CountItem {
  id: number;
  countId: number;
  productId: number;
  productName: string;
  locationName: string;
  countedByName: string | null;
  countedAt: Date;
  expected: number;
  counted: number;
  lots: CountedLot[];
  status: CountItemStatus;
  reviewedByName: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
}

export interface NewDailyCount {
  locationId: number;
  actorId: number;
  items: {
    productId: number;
    counted: number;
    lots: CountedLot[] | null;
    captureSource: CaptureSource | null;
  }[];
}
