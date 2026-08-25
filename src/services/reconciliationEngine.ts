import { BankTransaction, MatchCandidate } from "../types/bank";
import { Transaction } from "../store/useFinanceStore";

// Deterministic, local matching engine. No external/generative AI is used —
// financial reconciliation must be reproducible and explainable.
//
// Weighting (per spec, adjustable if real data suggests otherwise):
//   amount 40 | date 20 | description 15 | document/reference 15 | counterparty 5 | payment method 5

const DATE_TOLERANCE_DAYS = 3;

function daysBetween(a: string, b: string): number {
  const dateA = new Date(`${a}T00:00:00`).getTime();
  const dateB = new Date(`${b}T00:00:00`).getTime();
  return Math.abs(dateA - dateB) / 86_400_000;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenOverlapScore(a: string, b: string): number {
  const tokensA = new Set(normalize(a).split(" ").filter((t) => t.length > 2));
  const tokensB = new Set(normalize(b).split(" ").filter((t) => t.length > 2));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let shared = 0;
  tokensA.forEach((token) => {
    if (tokensB.has(token)) shared += 1;
  });
  return shared / Math.max(tokensA.size, tokensB.size);
}

/** ERP transaction type that corresponds to a bank credit is "receivable";
 * a bank debit corresponds to an ERP "payable". */
function expectedErpType(bankType: "credit" | "debit"): "payable" | "receivable" {
  return bankType === "credit" ? "receivable" : "payable";
}

export function scoreMatch(bankTxn: BankTransaction, erpTxn: Transaction): MatchCandidate | null {
  if (erpTxn.type !== expectedErpType(bankTxn.type)) return null;

  const reasons: string[] = [];
  let score = 0;

  // Amount — 40%. Exact match required to award full weight; small rounding
  // differences (<= R$0.05) still count as an exact match, larger gaps decay.
  const amountDiff = Math.abs(bankTxn.amount - erpTxn.amount);
  if (amountDiff <= 0.05) {
    score += 40;
    reasons.push("Mesmo valor");
  } else if (amountDiff / Math.max(bankTxn.amount, erpTxn.amount) <= 0.02) {
    score += 30;
    reasons.push("Valor muito próximo (diferença menor que 2%)");
  } else {
    return null; // amount is the strongest signal — no match if it's off by more than 2%
  }

  // Date — 20%. Compare bank transactionDate against ERP paymentDate (if
  // settled) or dueDate otherwise.
  const erpDate = erpTxn.paymentDate || erpTxn.dueDate;
  const dayDiff = daysBetween(bankTxn.transactionDate, erpDate);
  if (dayDiff === 0) {
    score += 20;
    reasons.push("Mesma data");
  } else if (dayDiff <= DATE_TOLERANCE_DAYS) {
    score += 12;
    reasons.push(`Data próxima (${Math.round(dayDiff)} dia(s) de diferença)`);
  }

  // Description similarity — 15%.
  const descScore = tokenOverlapScore(bankTxn.description, `${erpTxn.description} ${erpTxn.company}`);
  if (descScore > 0) {
    score += Math.round(descScore * 15);
    if (descScore >= 0.5) reasons.push("Descrição semelhante");
  }

  // Document/reference — 15%.
  if (bankTxn.documentNumber && erpTxn.document) {
    const bankDoc = normalize(bankTxn.documentNumber);
    const erpDoc = normalize(erpTxn.document);
    if (bankDoc && erpDoc && (bankDoc === erpDoc || bankDoc.includes(erpDoc) || erpDoc.includes(bankDoc))) {
      score += 15;
      reasons.push("Documento/referência coincide");
    }
  }

  // Counterparty — 5%.
  if (bankTxn.counterparty && erpTxn.company) {
    const overlap = tokenOverlapScore(bankTxn.counterparty, erpTxn.company);
    if (overlap >= 0.4) {
      score += 5;
      reasons.push("Nome do contraparte compatível");
    }
  }

  // Payment method — 5%. We don't have a strict payment-method field on the
  // bank side beyond the memo classification, so award partial credit when
  // the ERP's bankAccount label plausibly matches (best-effort, not a hard
  // requirement — never blocks a match on its own).
  score += 0; // reserved — no reliable signal yet without a normalized ERP payment-method field

  score = Math.min(100, Math.round(score));
  if (score < 40) return null;

  const confidence: MatchCandidate["confidence"] = score >= 90 ? "alta" : score >= 70 ? "media" : "baixa";

  return {
    bankTransactionId: bankTxn.id,
    erpTransactionId: erpTxn.id,
    score,
    reasons,
    confidence,
  };
}

/** For a given bank transaction, returns the best ERP match candidates
 * (already-reconciled ERP transactions are excluded by the caller). */
export function findMatchCandidates(bankTxn: BankTransaction, erpCandidates: Transaction[]): MatchCandidate[] {
  return erpCandidates
    .map((erpTxn) => scoreMatch(bankTxn, erpTxn))
    .filter((candidate): candidate is MatchCandidate => candidate !== null)
    .sort((a, b) => b.score - a.score);
}

/** Detects a probable internal transfer: a debit on one account and a credit
 * of the same amount on another of the company's own accounts, within a
 * short time window. */
export function findInternalTransferMatch(
  bankTxn: BankTransaction,
  allBankTxns: BankTransaction[]
): BankTransaction | null {
  const oppositeType = bankTxn.type === "credit" ? "debit" : "credit";
  const candidate = allBankTxns.find(
    (candidateTxn) =>
      candidateTxn.id !== bankTxn.id &&
      candidateTxn.bankAccountId !== bankTxn.bankAccountId &&
      candidateTxn.type === oppositeType &&
      Math.abs(candidateTxn.amount - bankTxn.amount) <= 0.05 &&
      daysBetween(candidateTxn.transactionDate, bankTxn.transactionDate) <= 1
  );
  return candidate || null;
}

/** Duplicate detection among already-imported bank transactions (same
 * account, same date/amount/description but different id — i.e. NOT caught
 * by the fingerprint because the source file itself repeats the row). */
export function findPossibleDuplicates(transactions: BankTransaction[]): BankTransaction[][] {
  const groups = new Map<string, BankTransaction[]>();
  transactions.forEach((txn) => {
    const key = `${txn.bankAccountId}|${txn.transactionDate}|${txn.amount.toFixed(2)}|${normalize(txn.description)}`;
    const group = groups.get(key) || [];
    group.push(txn);
    groups.set(key, group);
  });
  return Array.from(groups.values()).filter((group) => group.length > 1);
}
