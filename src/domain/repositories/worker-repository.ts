import type {
  Worker,
  WorkerDiscountUsage,
  WorkerNameSource,
  WorkerPurchase,
  WorkerStatus,
  WorkerWithPin,
} from "../entities/worker";

export interface CreateWorkerData {
  // Client-generated so a registration queued offline is idempotent.
  id: string;
  dni: string;
  fullName: string;
  nameSource: WorkerNameSource;
  company: string;
  pinHash: string;
  registeredById: string;
}

// What the POS keeps in IndexedDB to identify workers without internet.
// PIN hashes are only included for active workers.
export interface OfflineWorker {
  id: string;
  dni: string;
  fullName: string;
  company: string;
  status: WorkerStatus;
  pinHash: string | null;
  pointsBalance: number;
  usage: WorkerDiscountUsage;
}

export interface WorkerRepository {
  findById(id: string): Promise<WorkerWithPin | null>;
  findByDni(dni: string): Promise<WorkerWithPin | null>;
  findAll(status?: WorkerStatus): Promise<Worker[]>;
  countByStatus(): Promise<Record<WorkerStatus, number>>;
  // Returns false when a worker with this id already exists (retry).
  create(data: CreateWorkerData): Promise<boolean>;
  // A new PIN always sends the worker back to "pending" (pin_reset).
  replacePin(id: string, pinHash: string): Promise<void>;
  setStatus(id: string, status: WorkerStatus, actorId: string): Promise<void>;
  updateName(id: string, fullName: string, nameSource: WorkerNameSource): Promise<void>;
  discountUsage(
    workerId: string,
    dayStart: Date,
    monthStart: Date,
  ): Promise<WorkerDiscountUsage>;
  offlineSnapshot(dayStart: Date, monthStart: Date): Promise<OfflineWorker[]>;
  purchaseHistory(workerId: string, limit: number): Promise<WorkerPurchase[]>;
}
