import type {
  CountCandidateRow,
  CountItem,
  NewDailyCount,
} from "../entities/daily-count";

export interface DailyCountRepository {
  // Products with controlled stock at the location, with what the
  // suggestion needs. Products with a count awaiting review are left out.
  listCandidates(locationId: number, todayKey: string): Promise<CountCandidateRow[]>;
  // Snapshots the system balance under lock: matching counts close (and
  // refresh the lots' dates), different ones stay pending.
  submit(data: NewDailyCount): Promise<{ countId: number; matched: number; pending: number }>;
  // Pending first, then the latest reviewed.
  listItems(limit: number): Promise<CountItem[]>;
  findItem(id: number): Promise<CountItem | null>;
  // approve: adjusts the stock by (counted − expected) of the count's moment.
  review(data: {
    id: number;
    approve: boolean;
    note: string | null;
    actorId: number;
  }): Promise<void>;
}
