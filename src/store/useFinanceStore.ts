import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TransactionType = "payable" | "receivable";
export type TransactionStatus = "pending" | "paid" | "overdue" | "cancelled";
export type ErpReconciliationStatus = "unreconciled" | "reconciled" | "pending_review";

export interface Transaction {
  id: string;
  type: TransactionType;
  description: string;
  company: string; // display name, kept in sync with the linked customer/supplier
  customerId?: string; // links to Customer.id in useRegistryStore (type === "receivable")
  supplierId?: string; // links to Supplier.id in useRegistryStore (type === "payable")
  category: string; // display name, kept in sync with categoryId
  categoryId?: string; // links to Category.id in useBankStore
  amount: number;
  dueDate: string;
  paymentDate?: string;
  status: TransactionStatus;
  bankAccount: string; // display label, kept for backward compatibility
  bankAccountId?: string; // links to BankAccount.id in useBankStore
  document?: string;
  notes?: string;
  costCenter?: string; // display label, kept in sync with costCenterId
  costCenterId?: string; // links to CostCenter.id in useBankStore
  createdAt: string;
  // Reconciliation linkage against src/store/useBankStore.ts bank transactions.
  reconciliationStatus?: ErpReconciliationStatus;
  linkedBankTransactionIds?: string[];
  isDemoData?: boolean;
}

export interface FinanceFormData {
  type: TransactionType;
  description: string;
  company: string;
  customerId?: string;
  supplierId?: string;
  category: string;
  categoryId?: string;
  amount: number;
  dueDate: string;
  paymentDate?: string;
  status: TransactionStatus;
  bankAccount: string;
  bankAccountId?: string;
  document?: string;
  notes?: string;
  costCenter?: string;
  costCenterId?: string;
}

interface FinanceState {
  transactions: Transaction[];
  addTransaction: (data: FinanceFormData) => Transaction;
  updateTransaction: (id: string, data: Partial<FinanceFormData>) => void;
  deleteTransaction: (id: string) => void;
  markAsPaid: (id: string) => void;
  getTransaction: (id: string) => Transaction | undefined;
  linkToBankTransaction: (erpId: string, bankTransactionId: string) => void;
  unlinkFromBankTransaction: (erpId: string, bankTransactionId: string) => void;
  setReconciliationStatus: (erpId: string, status: ErpReconciliationStatus) => void;
}

// Demo data — clearly flagged with isDemoData so it can never be confused
// with real imported/entered records (spec §65 Mock Data Policy).
const initialTransactions: Transaction[] = [
  { id:"TRX-001", type:"receivable", description:"Mensalidades - Carteira Principal", company:"JR Proteção Veicular", category:"Mensalidades", amount:128500, dueDate:"2026-08-10", paymentDate:"2026-08-10", status:"paid", bankAccount:"Sicredi - Principal", document:"REC-2026-0810", createdAt:"2026-08-01", isDemoData:true, reconciliationStatus:"unreconciled" },
  { id:"TRX-002", type:"payable", description:"Folha de pagamento", company:"JR Proteção Veicular", category:"Pessoal", amount:38750, dueDate:"2026-08-20", paymentDate:"2026-08-20", status:"paid", bankAccount:"Sicredi - Principal", document:"FOL-082026", createdAt:"2026-08-01", isDemoData:true, reconciliationStatus:"unreconciled" },
  { id:"TRX-003", type:"payable", description:"Serviços de assistência 24h", company:"Guincho Sergipe Ltda.", category:"Assistência 24h", amount:18400, dueDate:"2026-08-25", status:"pending", bankAccount:"Sicredi - Principal", document:"NF-88342", createdAt:"2026-08-03", isDemoData:true, reconciliationStatus:"unreconciled" },
  { id:"TRX-004", type:"receivable", description:"Mensalidades - Segunda parcela", company:"JR Proteção Veicular", category:"Mensalidades", amount:96500, dueDate:"2026-08-25", status:"pending", bankAccount:"Sicredi - Principal", document:"REC-0825", createdAt:"2026-08-03", isDemoData:true, reconciliationStatus:"unreconciled" },
  { id:"TRX-005", type:"payable", description:"Aluguel sede administrativa", company:"Imóveis Central", category:"Estrutura", amount:7200, dueDate:"2026-08-30", status:"pending", bankAccount:"Sicredi - Principal", document:"ALUG-082026", createdAt:"2026-08-04", isDemoData:true, reconciliationStatus:"unreconciled" },
  { id:"TRX-006", type:"receivable", description:"Negociação de inadimplência", company:"Cliente corporativo", category:"Acordos", amount:15000, dueDate:"2026-08-18", status:"overdue", bankAccount:"Sicredi - Principal", document:"ACD-2026-004", createdAt:"2026-08-05", isDemoData:true, reconciliationStatus:"unreconciled" },
  { id:"TRX-007", type:"payable", description:"Campanha de mídia digital", company:"Agência Impacto", category:"Marketing", amount:9500, dueDate:"2026-08-28", status:"pending", bankAccount:"Sicredi - Marketing", document:"NF-2918", createdAt:"2026-08-06", isDemoData:true, reconciliationStatus:"unreconciled" },
  { id:"TRX-008", type:"receivable", description:"Adesões novas - semana 3", company:"Consultores Comerciais", category:"Adesões", amount:42500, dueDate:"2026-08-22", paymentDate:"2026-08-22", status:"paid", bankAccount:"Sicredi - Principal", document:"AD-0822", createdAt:"2026-08-07", isDemoData:true, reconciliationStatus:"unreconciled" },
  { id:"TRX-009", type:"payable", description:"Indenização - evento 4821", company:"Associado JR", category:"Indenizações", amount:28500, dueDate:"2026-09-05", status:"pending", bankAccount:"Sicredi - Principal", document:"IND-4821", createdAt:"2026-08-08", isDemoData:true, reconciliationStatus:"unreconciled" },
  { id:"TRX-010", type:"receivable", description:"Mensalidades recorrentes", company:"Carteira ativa", category:"Mensalidades", amount:113700, dueDate:"2026-08-30", status:"pending", bankAccount:"Sicredi - Principal", document:"REC-0830", createdAt:"2026-08-09", isDemoData:true, reconciliationStatus:"unreconciled" }
];

const generateId = (): string => `TRX-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set, get) => ({
      transactions: initialTransactions,

      addTransaction: (data: FinanceFormData) => {
        const created: Transaction = {
          ...data,
          id: generateId(),
          createdAt: new Date().toISOString(),
          reconciliationStatus: "unreconciled",
          linkedBankTransactionIds: [],
        };
        set((state) => ({ transactions: [created, ...state.transactions] }));
        return created;
      },

      updateTransaction: (id: string, data: Partial<FinanceFormData>) =>
        set((state) => ({
          transactions: state.transactions.map((t) => (t.id === id ? { ...t, ...data } : t)),
        })),

      deleteTransaction: (id: string) =>
        set((state) => ({ transactions: state.transactions.filter((t) => t.id !== id) })),

      markAsPaid: (id: string) =>
        set((state) => ({
          transactions: state.transactions.map((t) =>
            t.id === id
              ? { ...t, status: "paid", paymentDate: t.paymentDate || new Date().toISOString().slice(0, 10) }
              : t
          ),
        })),

      getTransaction: (id: string) => get().transactions.find((t) => t.id === id),

      linkToBankTransaction: (erpId: string, bankTransactionId: string) =>
        set((state) => ({
          transactions: state.transactions.map((t) =>
            t.id === erpId
              ? {
                  ...t,
                  reconciliationStatus: "reconciled",
                  linkedBankTransactionIds: Array.from(new Set([...(t.linkedBankTransactionIds || []), bankTransactionId])),
                }
              : t
          ),
        })),

      unlinkFromBankTransaction: (erpId: string, bankTransactionId: string) =>
        set((state) => ({
          transactions: state.transactions.map((t) =>
            t.id === erpId
              ? {
                  ...t,
                  reconciliationStatus: "unreconciled",
                  linkedBankTransactionIds: (t.linkedBankTransactionIds || []).filter((id) => id !== bankTransactionId),
                }
              : t
          ),
        })),

      setReconciliationStatus: (erpId: string, status: ErpReconciliationStatus) =>
        set((state) => ({
          transactions: state.transactions.map((t) => (t.id === erpId ? { ...t, reconciliationStatus: status } : t)),
        })),
    }),
    { name: "fin-erp-storage" }
  )
);
