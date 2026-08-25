import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  AuditLogEntry,
  BankAccount,
  BankTransaction,
  Category,
  CostCenter,
  DailyClosing,
  ImportBatch,
} from "../types/bank";
import { parseOfx, classifyMemo } from "../services/ofxParser";
import { buildBankTransactionFingerprint } from "../services/fingerprint";

const genId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const defaultCategories: Category[] = [
  { id: "cat-mensalidades", name: "Receita de Mensalidades", group: "receita" },
  { id: "cat-servicos", name: "Receita de Serviços", group: "receita" },
  { id: "cat-outras-receitas", name: "Outras Receitas", group: "receita" },
  { id: "cat-folha", name: "Folha de Pagamento", group: "despesa" },
  { id: "cat-aluguel", name: "Aluguel", group: "despesa" },
  { id: "cat-energia", name: "Energia", group: "despesa" },
  { id: "cat-combustivel", name: "Combustível", group: "despesa" },
  { id: "cat-manutencao", name: "Manutenção", group: "despesa" },
  { id: "cat-marketing", name: "Marketing", group: "despesa" },
  { id: "cat-material", name: "Material de Escritório", group: "despesa" },
  { id: "cat-impostos", name: "Impostos", group: "despesa" },
  { id: "cat-seguros", name: "Seguros", group: "despesa" },
  { id: "cat-sistemas", name: "Sistemas", group: "despesa" },
  { id: "cat-servicos-prof", name: "Serviços Profissionais", group: "despesa" },
  { id: "cat-indenizacoes", name: "Indenizações", group: "despesa" },
  { id: "cat-tarifas", name: "Tarifas Bancárias", group: "financeiro" },
  { id: "cat-juros", name: "Juros", group: "financeiro" },
  { id: "cat-receitas-fin", name: "Receitas Financeiras", group: "financeiro" },
  { id: "cat-despesas-fin", name: "Despesas Financeiras", group: "financeiro" },
  { id: "cat-nao-classificado", name: "Não classificado", group: "despesa" },
];

const defaultCostCenters: CostCenter[] = [
  { id: "cc-administrativo", name: "Administrativo" },
  { id: "cc-financeiro", name: "Financeiro" },
  { id: "cc-marketing", name: "Marketing" },
  { id: "cc-operacoes", name: "Operações" },
  { id: "cc-assistencia", name: "Assistência 24h" },
  { id: "cc-eventos", name: "Eventos" },
  { id: "cc-comercial", name: "Comercial" },
  { id: "cc-diretoria", name: "Diretoria" },
];

interface BankState {
  bankAccounts: BankAccount[];
  bankTransactions: BankTransaction[];
  importBatches: ImportBatch[];
  categories: Category[];
  costCenters: CostCenter[];
  auditLog: AuditLogEntry[];
  dailyClosings: DailyClosing[];

  // Bank accounts
  addBankAccount: (data: Omit<BankAccount, "id" | "createdAt" | "currentBankBalance" | "currentErpBalance">) => BankAccount;
  updateBankAccount: (id: string, data: Partial<BankAccount>) => void;

  // Import
  importOfxFile: (fileContent: string, filename: string) => ImportBatch;

  // Classification / lifecycle of a bank transaction
  classifyBankTransaction: (id: string, data: { categoryId?: string; costCenterId?: string; counterparty?: string }) => void;
  ignoreBankTransaction: (id: string, reason?: string) => void;
  markInternalTransfer: (bankTxnId: string, linkedBankTxnId: string) => void;

  // Reconciliation
  reconcileTransactions: (bankTxnIds: string[], erpTxnIds: string[]) => { ok: boolean; message: string };
  unreconcile: (bankTxnId: string) => void;

  // Audit
  logAudit: (entry: Omit<AuditLogEntry, "id" | "timestamp">) => void;

  // Daily closing
  closeDay: (bankAccountId: string, date: string, summary: Omit<DailyClosing, "id" | "bankAccountId" | "date" | "status" | "closedAt" | "reopenedAt">) => void;
  reopenDay: (bankAccountId: string, date: string, reason: string) => void;
  getDayStatus: (bankAccountId: string, date: string) => DailyClosing | undefined;

  // Categories / cost centers
  addCategory: (name: string, group: Category["group"]) => void;
  deleteCategory: (id: string) => void;
  addCostCenter: (name: string) => void;
  deleteCostCenter: (id: string) => void;
}

export const useBankStore = create<BankState>()(
  persist(
    (set, get) => ({
      bankAccounts: [],
      bankTransactions: [],
      importBatches: [],
      categories: defaultCategories,
      costCenters: defaultCostCenters,
      auditLog: [],
      dailyClosings: [],

      addBankAccount: (data) => {
        const account: BankAccount = {
          ...data,
          id: genId("BANK"),
          currentBankBalance: data.initialBalance,
          currentErpBalance: 0,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ bankAccounts: [...state.bankAccounts, account] }));
        get().logAudit({ entityType: "bank_account", entityId: account.id, action: "Conta bancária criada", details: `${account.bankName} • ${account.accountNumber}` });
        return account;
      },

      updateBankAccount: (id, data) => set((state) => ({
        bankAccounts: state.bankAccounts.map((acc) => (acc.id === id ? { ...acc, ...data } : acc)),
      })),

      importOfxFile: (fileContent, filename) => {
        const parsed = parseOfx(fileContent);
        const state = get();

        // Find or create the bank account this statement belongs to.
        let account = state.bankAccounts.find(
          (acc) => acc.bankCode === (parsed.bankId || "") && acc.accountNumber === (parsed.accountId || "")
        );
        if (!account && parsed.accountId) {
          account = get().addBankAccount({
            bankName: parsed.bankOrg?.trim() || "Banco não identificado",
            bankCode: parsed.bankId || "",
            accountNumber: parsed.accountId || "",
            accountName: parsed.bankOrg?.trim() || "Conta importada",
            initialBalance: 0,
            active: true,
          });
        }

        const warnings = [...parsed.warnings];
        const rejectedRows: { raw: string; reason: string }[] = [];

        if (!account) {
          const batch: ImportBatch = {
            id: genId("IMP"),
            bankAccountId: "",
            filename,
            fileType: "ofx",
            importedAt: new Date().toISOString(),
            totalRows: parsed.transactions.length,
            importedCount: 0,
            duplicateCount: 0,
            errorCount: parsed.transactions.length,
            warnings: ["Não foi possível identificar a conta bancária (ACCTID ausente no arquivo)."],
            rejectedRows,
            status: "failed",
          };
          set((s) => ({ importBatches: [batch, ...s.importBatches] }));
          return batch;
        }

        const existingFingerprints = new Set(
          get().bankTransactions.filter((t) => t.bankAccountId === account!.id).map((t) => t.fingerprint)
        );

        const newTransactions: BankTransaction[] = [];
        let duplicateCount = 0;
        const sourceFileId = genId("FILE");
        const now = new Date().toISOString();

        parsed.transactions.forEach((tx) => {
          const fingerprint = buildBankTransactionFingerprint({
            bankAccountId: account!.id,
            transactionDate: tx.transactionDate,
            amount: tx.amount,
            type: tx.type,
            description: tx.memo,
            documentNumber: tx.checkNum,
            bankProvidedId: tx.fitId || tx.refNum,
          });

          if (existingFingerprints.has(fingerprint)) {
            duplicateCount += 1;
            return;
          }
          existingFingerprints.add(fingerprint);

          const { kind, counterparty } = classifyMemo(tx.memo);
          const isFee = kind === "tarifa";

          newTransactions.push({
            id: genId("BTX"),
            bankAccountId: account!.id,
            transactionDate: tx.transactionDate,
            description: tx.memo,
            originalDescription: tx.memo,
            documentNumber: tx.fitId || tx.refNum,
            type: tx.type,
            amount: tx.amount,
            source: "bank_statement",
            sourceFileId,
            fingerprint,
            reconciliationStatus: "unreconciled",
            matchedTransactionIds: [],
            categoryId: isFee ? "cat-tarifas" : undefined,
            counterparty,
            createdAt: now,
            updatedAt: now,
          });
        });

        // Balance validation: opening (derived) + credits - debits should equal
        // the statement's ledger balance, if provided.
        let calculatedBalance: number | undefined;
        let balanceDivergence: number | undefined;
        if (parsed.ledgerBalance !== undefined) {
          const allTxForAccount = [...get().bankTransactions.filter((t) => t.bankAccountId === account!.id), ...newTransactions];
          const netMovement = allTxForAccount.reduce((sum, t) => sum + (t.type === "credit" ? t.amount : -t.amount), 0);
          calculatedBalance = (account!.initialBalance || 0) + netMovement;
          balanceDivergence = Math.round((calculatedBalance - parsed.ledgerBalance) * 100) / 100;
          if (Math.abs(balanceDivergence) > 0.01) {
            warnings.push(
              `Divergência no extrato: saldo calculado ${calculatedBalance.toFixed(2)} difere do saldo informado pelo banco ${parsed.ledgerBalance.toFixed(2)} (diferença de ${balanceDivergence.toFixed(2)}).`
            );
          }
        }

        if (duplicateCount > 0) {
          warnings.push(`${duplicateCount} transaç${duplicateCount === 1 ? "ão já estava" : "ões já estavam"} importada${duplicateCount === 1 ? "" : "s"} e não ${duplicateCount === 1 ? "foi duplicada" : "foram duplicadas"}.`);
        }

        set((s) => ({
          bankTransactions: [...newTransactions, ...s.bankTransactions],
        }));

        if (parsed.ledgerBalance !== undefined) {
          get().updateBankAccount(account.id, {
            currentBankBalance: parsed.ledgerBalance,
            lastImportedDate: parsed.ledgerBalanceDate || new Date().toISOString().slice(0, 10),
          });
        }

        const batch: ImportBatch = {
          id: genId("IMP"),
          bankAccountId: account.id,
          filename,
          fileType: "ofx",
          importedAt: now,
          periodStart: parsed.periodStart,
          periodEnd: parsed.periodEnd,
          statementBalance: parsed.ledgerBalance,
          statementBalanceDate: parsed.ledgerBalanceDate,
          calculatedBalance,
          balanceDivergence,
          totalRows: parsed.transactions.length,
          importedCount: newTransactions.length,
          duplicateCount,
          errorCount: parsed.transactions.length - newTransactions.length - duplicateCount,
          warnings,
          rejectedRows,
          status: warnings.length > 0 ? "completed_with_warnings" : "completed",
        };

        set((s) => ({ importBatches: [batch, ...s.importBatches] }));
        get().logAudit({
          entityType: "import",
          entityId: batch.id,
          action: "Extrato bancário importado",
          details: `${filename}: ${newTransactions.length} importadas, ${duplicateCount} duplicadas, ${batch.errorCount} com erro.`,
        });

        return batch;
      },

      classifyBankTransaction: (id, data) => {
        set((state) => ({
          bankTransactions: state.bankTransactions.map((t) =>
            t.id === id ? { ...t, ...data, updatedAt: new Date().toISOString() } : t
          ),
        }));
        get().logAudit({ entityType: "bank_transaction", entityId: id, action: "Classificação atualizada", details: JSON.stringify(data) });
      },

      ignoreBankTransaction: (id, reason) => {
        set((state) => ({
          bankTransactions: state.bankTransactions.map((t) =>
            t.id === id ? { ...t, reconciliationStatus: "ignored", notes: reason || t.notes, updatedAt: new Date().toISOString() } : t
          ),
        }));
        get().logAudit({ entityType: "bank_transaction", entityId: id, action: "Transação ignorada", details: reason });
      },

      markInternalTransfer: (bankTxnId, linkedBankTxnId) => {
        set((state) => ({
          bankTransactions: state.bankTransactions.map((t) => {
            if (t.id === bankTxnId || t.id === linkedBankTxnId) {
              return { ...t, isInternalTransfer: true, reconciliationStatus: "manually_reconciled", updatedAt: new Date().toISOString() };
            }
            return t;
          }),
        }));
        get().logAudit({ entityType: "bank_transaction", entityId: bankTxnId, action: "Marcado como transferência interna", newValue: linkedBankTxnId });
      },

      reconcileTransactions: (bankTxnIds, erpTxnIds) => {
        const state = get();
        const bankTxns = state.bankTransactions.filter((t) => bankTxnIds.includes(t.id));
        if (bankTxns.length === 0) return { ok: false, message: "Nenhuma transação bancária selecionada." };

        const bankTotal = bankTxns.reduce((sum, t) => sum + t.amount, 0);
        // erpTotal is validated by the caller (UI) against ERP store data before
        // calling this action for 1:many / many:1 cases; here we just persist
        // the link and flag the status.
        void erpTxnIds;

        const now = new Date().toISOString();
        set((s) => ({
          bankTransactions: s.bankTransactions.map((t) =>
            bankTxnIds.includes(t.id)
              ? { ...t, reconciliationStatus: "manually_reconciled", matchedTransactionIds: erpTxnIds, updatedAt: now }
              : t
          ),
        }));

        bankTxnIds.forEach((bankId) => {
          get().logAudit({
            entityType: "bank_transaction",
            entityId: bankId,
            action: "Conciliação",
            previousValue: "unreconciled",
            newValue: "reconciled",
            details: `Vinculado a: ${erpTxnIds.join(", ")} • valor total banco: ${bankTotal.toFixed(2)}`,
          });
        });

        return { ok: true, message: "Conciliação registrada." };
      },

      unreconcile: (bankTxnId) => {
        set((state) => ({
          bankTransactions: state.bankTransactions.map((t) =>
            t.id === bankTxnId ? { ...t, reconciliationStatus: "unreconciled", matchedTransactionIds: [], updatedAt: new Date().toISOString() } : t
          ),
        }));
        get().logAudit({ entityType: "bank_transaction", entityId: bankTxnId, action: "Conciliação desfeita" });
      },

      logAudit: (entry) => {
        const logEntry: AuditLogEntry = { ...entry, id: genId("LOG"), timestamp: new Date().toISOString() };
        set((state) => ({ auditLog: [logEntry, ...state.auditLog].slice(0, 500) }));
      },

      closeDay: (bankAccountId, date, summary) => {
        const id = `${bankAccountId}:${date}`;
        const now = new Date().toISOString();
        set((state) => {
          const existingIndex = state.dailyClosings.findIndex((d) => d.id === id);
          const closing: DailyClosing = { id, bankAccountId, date, ...summary, status: "closed", closedAt: now };
          const dailyClosings = [...state.dailyClosings];
          if (existingIndex >= 0) dailyClosings[existingIndex] = closing;
          else dailyClosings.push(closing);
          return { dailyClosings };
        });
        get().logAudit({ entityType: "day_closing", entityId: id, action: "Dia fechado", details: `Diferença: ${summary.difference.toFixed(2)}` });
      },

      reopenDay: (bankAccountId, date, reason) => {
        const id = `${bankAccountId}:${date}`;
        const previous = get().dailyClosings.find((d) => d.id === id);
        set((state) => ({
          dailyClosings: state.dailyClosings.map((d) => (d.id === id ? { ...d, status: "open", reopenedAt: new Date().toISOString() } : d)),
        }));
        get().logAudit({
          entityType: "day_closing",
          entityId: id,
          action: "Dia reaberto",
          previousValue: "closed",
          newValue: "open",
          details: `Motivo: ${reason}${previous ? ` • Diferença registrada no fechamento anterior: ${previous.difference.toFixed(2)}` : ""}`,
        });
      },

      getDayStatus: (bankAccountId, date) => get().dailyClosings.find((d) => d.id === `${bankAccountId}:${date}`),

      addCategory: (name, group) => set((state) => ({ categories: [...state.categories, { id: genId("cat"), name, group }] })),
      deleteCategory: (id) => set((state) => ({ categories: state.categories.filter((c) => c.id !== id) })),
      addCostCenter: (name) => set((state) => ({ costCenters: [...state.costCenters, { id: genId("cc"), name }] })),
      deleteCostCenter: (id) => set((state) => ({ costCenters: state.costCenters.filter((c) => c.id !== id) })),
    }),
    { name: "fin-erp-bank-storage" }
  )
);
