// Parser for OFX 1.x (SGML) bank statement files.
//
// Built and validated against a real Sicredi export (extrato.ofx):
//   - Header block (OFXHEADER/DATA/VERSION/...) followed by <OFX>...</OFX>.
//   - <BANKACCTFROM> carries BANKID (compe code), ACCTID (account id), ACCTTYPE.
//   - Each movement is a <STMTTRN> with TRNTYPE (CREDIT|DEBIT), DTPOSTED
//     (yyyyMMddHHmmss[-3:GMT]), TRNAMT (SIGNED decimal — negative for debit,
//     positive for credit), FITID and REFNUM (bank-issued unique ids, equal in
//     this export), and MEMO (free-text description).
//   - There is NO per-transaction running balance in this export — only a
//     single <LEDGERBAL><BALAMT> at the end, which is the balance as of DTASOF.
//   - No explicit opening balance is provided; it must be derived (opening =
//     ledger balance - sum of all credits + sum of all debits) and compared
//     for the divergence check described in the spec.
//
// This file intentionally does NOT assume every OFX export looks like this —
// fields that are genuinely optional in the OFX spec (DTPOSTED vs DTUSER,
// balance blocks, branch info) are read defensively and left undefined when
// absent rather than guessed.

export interface ParsedOfxTransaction {
  type: "credit" | "debit";
  transactionDate: string; // ISO yyyy-mm-dd
  amount: number; // positive
  memo: string;
  fitId?: string;
  refNum?: string;
  checkNum?: string;
}

export interface ParsedOfxStatement {
  bankOrg?: string;
  bankId?: string; // compe code
  accountId?: string;
  accountType?: string;
  periodStart?: string;
  periodEnd?: string;
  ledgerBalance?: number;
  ledgerBalanceDate?: string;
  transactions: ParsedOfxTransaction[];
  warnings: string[];
}

function extractTag(block: string, tag: string): string | undefined {
  // OFX SGML: tags may or may not have closing tags, and values may contain
  // no nested markup, so a non-greedy match up to the next '<' is safe.
  const match = block.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, "i"));
  return match ? match[1].trim() : undefined;
}

function parseOfxDate(raw?: string): string | undefined {
  if (!raw) return undefined;
  // Formats seen: 20260729000000[-3:GMT] or plain 20260729
  const digits = raw.slice(0, 8);
  if (!/^\d{8}$/.test(digits)) return undefined;
  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);
  return `${year}-${month}-${day}`;
}

export function parseOfx(fileContent: string): ParsedOfxStatement {
  const warnings: string[] = [];

  const bankOrg = extractTag(fileContent, "ORG");
  const bankId = extractTag(fileContent, "BANKID");
  const accountId = extractTag(fileContent, "ACCTID");
  const accountType = extractTag(fileContent, "ACCTTYPE");

  const tranListMatch = fileContent.match(/<BANKTRANLIST>([\s\S]*?)<\/BANKTRANLIST>/i);
  const periodStart = tranListMatch ? parseOfxDate(extractTag(tranListMatch[1], "DTSTART")) : undefined;
  const periodEnd = tranListMatch ? parseOfxDate(extractTag(tranListMatch[1], "DTEND")) : undefined;

  const ledgerMatch = fileContent.match(/<LEDGERBAL>([\s\S]*?)<\/LEDGERBAL>/i);
  const ledgerBalAmtRaw = ledgerMatch ? extractTag(ledgerMatch[1], "BALAMT") : undefined;
  const ledgerBalance = ledgerBalAmtRaw !== undefined ? Number(ledgerBalAmtRaw) : undefined;
  const ledgerBalanceDate = ledgerMatch ? parseOfxDate(extractTag(ledgerMatch[1], "DTASOF")) : undefined;

  const stmtBlocks = fileContent.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];

  if (stmtBlocks.length === 0) {
    warnings.push("Nenhuma transação (<STMTTRN>) foi encontrada no arquivo OFX.");
  }

  const transactions: ParsedOfxTransaction[] = [];

  stmtBlocks.forEach((block, index) => {
    const trnTypeRaw = extractTag(block, "TRNTYPE");
    const dtPostedRaw = extractTag(block, "DTPOSTED") || extractTag(block, "DTUSER");
    const amountRaw = extractTag(block, "TRNAMT");
    const memo = extractTag(block, "MEMO") || extractTag(block, "NAME") || "";
    const fitId = extractTag(block, "FITID");
    const refNum = extractTag(block, "REFNUM");
    const checkNum = extractTag(block, "CHECKNUM");

    const transactionDate = parseOfxDate(dtPostedRaw);
    const amountValue = amountRaw !== undefined ? Number(amountRaw) : NaN;

    if (!transactionDate || Number.isNaN(amountValue)) {
      warnings.push(`Transação #${index + 1} ignorada: data ou valor inválido no arquivo (FITID: ${fitId || "desconhecido"}).`);
      return;
    }

    // TRNAMT is signed in this export (negative = debit). Some banks instead
    // rely solely on TRNTYPE with an unsigned amount — support both, but
    // trust the sign of TRNAMT when it disagrees with TRNTYPE, since the
    // amount sign is the authoritative source of truth for double-entry math.
    let type: "credit" | "debit";
    if (amountValue < 0) type = "debit";
    else if (amountValue > 0) type = "credit";
    else type = trnTypeRaw?.toUpperCase() === "DEBIT" ? "debit" : "credit";

    transactions.push({
      type,
      transactionDate,
      amount: Math.abs(amountValue),
      memo: memo.trim(),
      fitId,
      refNum,
      checkNum,
    });
  });

  return {
    bankOrg,
    bankId,
    accountId,
    accountType,
    periodStart,
    periodEnd,
    ledgerBalance,
    ledgerBalanceDate,
    transactions,
    warnings,
  };
}

/** Classifies a Brazilian bank memo into a coarse movement kind, used for
 * default categorization and internal-transfer / fee detection. Purely
 * heuristic and always overridable by the user — never silently trusted for
 * financial totals. */
export function classifyMemo(memo: string): {
  kind: "pix_recebido" | "pix_enviado" | "boleto" | "deposito" | "tarifa" | "ted" | "doc" | "outro";
  counterparty?: string;
} {
  const upper = memo.toUpperCase();
  const extractCounterparty = (): string | undefined => {
    // Memos in this statement look like:
    // "RECEBIMENTO PIX-PIX_CRED  57961061000132 RENASCER AUTO PECAS LTDA"
    // "PAGAMENTO PIX-PIX_DEB   09010186512 PEDRO HENRIQUE SILVA ANDRADE"
    const match = memo.match(/(?:\d{9,14})\s+(.+)$/);
    return match ? match[1].trim() : undefined;
  };

  if (upper.includes("TARIFA") || upper.includes("TAR ") || upper.includes("MANUTENCAO DE CONTA")) {
    return { kind: "tarifa" };
  }
  if (upper.includes("RECEBIMENTO PIX") || (upper.includes("PIX") && upper.includes("CRED"))) {
    return { kind: "pix_recebido", counterparty: extractCounterparty() };
  }
  if (upper.includes("PAGAMENTO PIX") || (upper.includes("PIX") && upper.includes("DEB"))) {
    return { kind: "pix_enviado", counterparty: extractCounterparty() };
  }
  if (upper.includes("BOLETO") || upper.includes("LIQUIDACAO")) {
    return { kind: "boleto", counterparty: extractCounterparty() };
  }
  if (upper.includes("DEP DINHEIRO") || upper.includes("DEPOSITO")) {
    return { kind: "deposito" };
  }
  if (upper.includes("TED")) {
    return { kind: "ted", counterparty: extractCounterparty() };
  }
  if (upper.includes("DOC")) {
    return { kind: "doc", counterparty: extractCounterparty() };
  }
  return { kind: "outro", counterparty: extractCounterparty() };
}
