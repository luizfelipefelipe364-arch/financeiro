// Deterministic, synchronous string hashing used to fingerprint imported bank
// transactions so the same statement can be imported twice without creating
// duplicates. We deliberately avoid crypto.subtle (async) so this can run in a
// tight synchronous import loop over hundreds of rows.

function djb2(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  // Force unsigned 32-bit and hex-encode.
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Builds a fingerprint for a normalized bank transaction.
 *
 * Priority order for the "strong identifier" component:
 * 1. A bank-provided unique id (FITID/REFNUM from OFX) — this is the strongest
 *    signal because the bank itself guarantees uniqueness per account.
 * 2. Falls back to a composite of account + date + amount + description +
 *    document number for sources that don't provide a stable id (plain CSV).
 */
export function buildBankTransactionFingerprint(params: {
  bankAccountId: string;
  transactionDate: string;
  amount: number;
  type: "credit" | "debit";
  description: string;
  documentNumber?: string;
  bankProvidedId?: string;
}): string {
  const { bankAccountId, transactionDate, amount, type, description, documentNumber, bankProvidedId } = params;

  if (bankProvidedId && bankProvidedId.trim().length > 0) {
    return `bid:${djb2(`${bankAccountId}|${bankProvidedId.trim()}`)}`;
  }

  const normalizedDescription = description.trim().toLowerCase().replace(/\s+/g, " ");
  const composite = [
    bankAccountId,
    transactionDate,
    type,
    amount.toFixed(2),
    normalizedDescription,
    (documentNumber || "").trim().toLowerCase(),
  ].join("|");

  return `cmp:${djb2(composite)}`;
}
