import type {
  AuditEvent,
  AuditEventInput,
  AuditEventType,
  CashierAuditSummary,
  FlaggedSale,
} from "../entities/audit";

export interface AuditRepository {
  record(event: AuditEventInput): Promise<void>;
  // Idempotent by the client uuid: events queued offline may be sent more
  // than once.
  recordWithUuid(uuid: string, event: AuditEventInput): Promise<void>;
  listEvents(filter: {
    from: Date;
    to: Date;
    types?: AuditEventType[];
    limit: number;
  }): Promise<AuditEvent[]>;
  // Failed "Mis puntos" logins for a worker since the given time (lockout).
  countStatementFailuresSince(workerId: number, since: Date): Promise<number>;
  cashierSummary(from: Date, to: Date): Promise<CashierAuditSummary[]>;
  flaggedSales(from: Date, to: Date): Promise<FlaggedSale[]>;
}
