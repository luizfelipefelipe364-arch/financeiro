import { BankAccount, BankTransaction } from "../types/bank";
import { Transaction } from "../store/useFinanceStore";

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** ERP balance for an account: paid receivables minus paid payables, all-time. */
export function calcErpBalance(transactions: Transaction[], bankAccountId?: string): number {
  const scoped = bankAccountId ? transactions.filter((t) => t.bankAccountId === bankAccountId) : transactions;
  const received = scoped.filter((t) => t.type === "receivable" && t.status === "paid").reduce((s, t) => s + t.amount, 0);
  const paid = scoped.filter((t) => t.type === "payable" && t.status === "paid").reduce((s, t) => s + t.amount, 0);
  return received - paid;
}

export function calcTodayInflowOutflow(bankTransactions: BankTransaction[], date: string, bankAccountId?: string) {
  const scoped = bankTransactions.filter((t) => t.transactionDate === date && (!bankAccountId || t.bankAccountId === bankAccountId));
  const inflow = scoped.filter((t) => t.type === "credit").reduce((s, t) => s + t.amount, 0);
  const outflow = scoped.filter((t) => t.type === "debit").reduce((s, t) => s + t.amount, 0);
  return { inflow, outflow, count: scoped.length };
}

export function calcReconciliationStats(bankTransactions: BankTransaction[], bankAccountId?: string) {
  const scoped = bankAccountId ? bankTransactions.filter((t) => t.bankAccountId === bankAccountId) : bankTransactions;
  const total = scoped.length;
  const reconciled = scoped.filter((t) => t.reconciliationStatus === "reconciled" || t.reconciliationStatus === "manually_reconciled").length;
  const unreconciled = scoped.filter((t) => t.reconciliationStatus === "unreconciled" || t.reconciliationStatus === "suggested").length;
  const percentage = total === 0 ? 0 : reconciled / total;
  return { total, reconciled, unreconciled, percentage };
}

export function calcOverallBankBalance(bankAccounts: BankAccount[]): number {
  return bankAccounts.filter((a) => a.active).reduce((sum, acc) => sum + acc.currentBankBalance, 0);
}
