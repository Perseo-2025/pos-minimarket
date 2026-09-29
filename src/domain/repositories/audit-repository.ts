import type {
  AuditEvent,
  AuditEventInput,
  AuditEventType,
  CashierAuditSummary,
  FlaggedSale,
} from "../entities/audit";

export interface AuditRepository {
  record(event: AuditEventInput): Promise<void>;
  // Idempotent by id: events queued offline may be sent more than once.
  recordWithId(id: string, event: AuditEventInput): Promise<void>;
  listEvents(filter: {
    from: Date;
    to: Date;
    types?: AuditEventType[];
    limit: number;
  }): Promise<AuditEvent[]>;
  countPinFailuresSince(workerId: string, since: Date): Promise<number>;
  cashierSummary(from: Date, to: Date): Promise<CashierAuditSummary[]>;
  flaggedSales(from: Date, to: Date): Promise<FlaggedSale[]>;
}
