// Domain types for banking, import and reconciliation.
// These are intentionally separate from src/store/useFinanceStore.ts (ERP financial
// transactions) so the reconciliation engine can compare two independent datasets:
// what the BANK says happened vs. what the ERP says happened.

export interface BankAccount {
  id: string;
  bankName: string;
  bankCode: string;
  branch?: string;
  accountNumber: string;
  accountName: string;
  initialBalance: number;
  currentBankBalance: number; // last known balance reported by the bank (LEDGERBAL / saldo do extrato)
  currentErpBalance: number; // computed from reconciled + pending ERP cash movements
  lastImportedDate?: string;
  lastReconciliationDate?: string;
  active: boolean;
  createdAt: string;
}

export type BankTransactionType = "credit" | "debit";

export type ReconciliationStatus =
  | "unreconciled"
  | "suggested"
  | "reconciled"
  | "manually_reconciled"
  | "ignored";

export interface BankTransaction {
  id: string;
  bankAccountId: string;
  transactionDate: string; // ISO yyyy-mm-dd
  postingDate?: string;
  description: string; // normalized/cleaned description
  originalDescription: string; // exactly as extracted from the source file
  documentNumber?: string; // FITID/REFNUM or boleto/document number when present
  type: BankTransactionType;
  amount: number; // always positive; sign is carried by `type`
  balanceAfter?: number;
  source: "bank_statement";
  sourceFileId: string;
  fingerprint: string;
  reconciliationStatus: ReconciliationStatus;
  matchedTransactionIds: string[]; // ids of ERP Transaction(s) linked to this bank movement
  categoryId?: string;
  costCenterId?: string;
  counterparty?: string; // best-effort name/document extracted from memo
  isInternalTransfer?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImportRejectedRow {
  raw: string;
  reason: string;
}

export interface ImportBatch {
  id: string;
  bankAccountId: string;
  filename: string;
  fileType: "ofx" | "csv" | "xlsx";
  importedAt: string;
  periodStart?: string;
  periodEnd?: string;
  statementBalance?: number;
  statementBalanceDate?: string;
  calculatedBalance?: number;
  balanceDivergence?: number;
  totalRows: number;
  importedCount: number;
  duplicateCount: number;
  errorCount: number;
  warnings: string[];
  rejectedRows: ImportRejectedRow[];
  status: "completed" | "completed_with_warnings" | "failed";
}

export interface Category {
  id: string;
  name: string;
  group: "receita" | "despesa" | "financeiro";
}

export interface CostCenter {
  id: string;
  name: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  entityType:
    | "bank_transaction"
    | "erp_transaction"
    | "import"
    | "day_closing"
    | "month_closing"
    | "bank_account";
  entityId: string;
  action: string;
  previousValue?: string;
  newValue?: string;
  details?: string;
}

export interface DailyClosing {
  id: string; // `${bankAccountId}:${date}`
  bankAccountId: string;
  date: string;
  bankBalance: number;
  erpBalance: number;
  difference: number;
  totalTransactions: number;
  reconciledTransactions: number;
  pendingTransactions: number;
  status: "closed" | "open";
  closedAt?: string;
  reopenedAt?: string;
}

export interface MatchCandidate {
  bankTransactionId: string;
  erpTransactionId: string;
  score: number; // 0-100
  reasons: string[];
  confidence: "alta" | "media" | "baixa";
}
