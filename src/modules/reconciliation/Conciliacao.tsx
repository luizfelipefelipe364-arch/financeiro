import { useMemo, useState } from "react";
import { CheckCircle2, XCircle, PlusCircle, Ban, ArrowLeftRight, AlertTriangle, Search } from "lucide-react";
import toast from "react-hot-toast";
import Card from "../../shared/ui/Card";
import Button from "../../shared/ui/Button";
import Modal from "../../shared/ui/Modal";
import Input from "../../shared/ui/Input";
import { useBankStore } from "../../store/useBankStore";
import { useFinanceStore, FinanceFormData } from "../../store/useFinanceStore";
import { formatBRL, formatDate } from "../../shared/utils/formatters";
import { findMatchCandidates, findPossibleDuplicates } from "../../services/reconciliationEngine";
import { BankTransaction, MatchCandidate } from "../../types/bank";

type Tab = "sugeridas" | "revisao" | "somente-banco" | "somente-erp" | "conciliadas" | "duplicidades";

export default function Conciliacao() {
  const bankTransactions = useBankStore((s) => s.bankTransactions);
  const bankAccounts = useBankStore((s) => s.bankAccounts);
  const categories = useBankStore((s) => s.categories);
  const costCenters = useBankStore((s) => s.costCenters);
  const reconcileTransactions = useBankStore((s) => s.reconcileTransactions);
  const ignoreBankTransaction = useBankStore((s) => s.ignoreBankTransaction);
  const classifyBankTransaction = useBankStore((s) => s.classifyBankTransaction);

  const erpTransactions = useFinanceStore((s) => s.transactions);
  const addErpTransaction = useFinanceStore((s) => s.addTransaction);
  const linkToBankTransaction = useFinanceStore((s) => s.linkToBankTransaction);

  const [tab, setTab] = useState<Tab>("sugeridas");
  const [search, setSearch] = useState("");
  const [createModalTxn, setCreateModalTxn] = useState<BankTransaction | null>(null);

  const unreconciledErp = useMemo(
    () => erpTransactions.filter((t) => !t.linkedBankTransactionIds || t.linkedBankTransactionIds.length === 0),
    [erpTransactions]
  );

  const suggestions = useMemo(() => {
    const pending = bankTransactions.filter((t) => t.reconciliationStatus === "unreconciled" && !t.isInternalTransfer);
    const results: { bankTxn: BankTransaction; candidate: MatchCandidate }[] = [];
    pending.forEach((bankTxn) => {
      const candidates = findMatchCandidates(bankTxn, unreconciledErp);
      if (candidates.length > 0) results.push({ bankTxn, candidate: candidates[0] });
    });
    return results.sort((a, b) => b.candidate.score - a.candidate.score);
  }, [bankTransactions, unreconciledErp]);

  const suggestedBankIds = new Set(suggestions.map((s) => s.bankTxn.id));

  const bankOnly = useMemo(
    () => bankTransactions.filter((t) => (t.reconciliationStatus === "unreconciled") && !suggestedBankIds.has(t.id) && !t.isInternalTransfer),
    [bankTransactions, suggestedBankIds]
  );

  const reconciled = useMemo(
    () => bankTransactions.filter((t) => t.reconciliationStatus === "reconciled" || t.reconciliationStatus === "manually_reconciled"),
    [bankTransactions]
  );

  const erpOnly = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return unreconciledErp.filter((t) => t.status === "paid" || (t.status === "pending" && t.dueDate < today));
  }, [unreconciledErp]);

  const duplicateGroups = useMemo(() => findPossibleDuplicates(bankTransactions.filter((t) => t.reconciliationStatus !== "ignored")), [bankTransactions]);

  const filterBySearch = <T extends { description?: string }>(items: T[]) =>
    search ? items.filter((i) => (i.description || "").toLowerCase().includes(search.toLowerCase())) : items;

  const handleAccept = (bankTxn: BankTransaction, candidate: MatchCandidate) => {
    reconcileTransactions([bankTxn.id], [candidate.erpTransactionId]);
    linkToBankTransaction(candidate.erpTransactionId, bankTxn.id);
    toast.success("Transação conciliada com sucesso.");
  };

  const handleIgnore = (bankTxn: BankTransaction) => {
    ignoreBankTransaction(bankTxn.id, "Ignorada manualmente pelo usuário.");
    toast("Transação marcada como ignorada.", { icon: "🚫" });
  };

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "sugeridas", label: "Sugestões", count: suggestions.length },
    { id: "somente-banco", label: "Somente no banco", count: bankOnly.length },
    { id: "somente-erp", label: "Somente no ERP", count: erpOnly.length },
    { id: "duplicidades", label: "Possíveis duplicidades", count: duplicateGroups.length },
    { id: "conciliadas", label: "Conciliadas", count: reconciled.length },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-gray-500">Controle bancário</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Conciliação Bancária</h1>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-xl border p-4 text-left transition ${tab === t.id ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}
          >
            <p className="text-xs text-gray-500">{t.label}</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{t.count}</p>
          </button>
        ))}
      </div>

      <Card>
        <div className="border-b border-gray-100 p-4">
          <div className="relative max-w-xl">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por descrição..." className="h-10 w-full rounded-lg border border-gray-300 pl-10 pr-3 text-sm outline-none focus:border-blue-500" />
          </div>
        </div>

        {tab === "sugeridas" && (
          <div className="divide-y divide-gray-100">
            {filterBySearch(suggestions.map((s) => ({ ...s, description: s.bankTxn.description }))).length === 0 ? (
              <EmptyState text="Nenhuma sugestão de conciliação no momento." />
            ) : (
              filterBySearch(suggestions.map((s) => ({ ...s, description: s.bankTxn.description }))).map(({ bankTxn, candidate }) => {
                const erpTxn = erpTransactions.find((t) => t.id === candidate.erpTransactionId)!;
                return (
                  <div key={bankTxn.id} className="space-y-3 p-4">
                    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                      <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="rounded-lg border border-gray-200 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Banco</p>
                          <p className="mt-1 text-sm font-medium text-gray-900">{bankTxn.description}</p>
                          <p className="text-xs text-gray-500">{formatDate(bankTxn.transactionDate)} • {bankTxn.type === "credit" ? "+" : "-"}{formatBRL(bankTxn.amount)}</p>
                        </div>
                        <div className="rounded-lg border border-gray-200 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">ERP</p>
                          <p className="mt-1 text-sm font-medium text-gray-900">{erpTxn.description}</p>
                          <p className="text-xs text-gray-500">{formatDate(erpTxn.paymentDate || erpTxn.dueDate)} • {formatBRL(erpTxn.amount)} • {erpTxn.company}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <ConfidenceBadge candidate={candidate} />
                        <Button size="sm" variant="success" onClick={() => handleAccept(bankTxn, candidate)}><CheckCircle2 size={15} />Conciliar</Button>
                        <Button size="sm" variant="secondary" onClick={() => handleIgnore(bankTxn)}><XCircle size={15} />Rejeitar</Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pl-1">
                      {candidate.reasons.map((reason) => (
                        <span key={reason} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">✓ {reason}</span>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === "somente-banco" && (
          <div className="divide-y divide-gray-100">
            {filterBySearch(bankOnly).length === 0 ? (
              <EmptyState text="Nenhuma transação pendente de classificação." />
            ) : (
              filterBySearch(bankOnly).map((bankTxn) => (
                <div key={bankTxn.id} className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{bankTxn.description}</p>
                    <p className="text-xs text-gray-500">{formatDate(bankTxn.transactionDate)} • {bankAccounts.find((a) => a.id === bankTxn.bankAccountId)?.bankName} • {bankTxn.categoryId ? categories.find((c) => c.id === bankTxn.categoryId)?.name : "Não classificado"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-semibold ${bankTxn.type === "credit" ? "text-emerald-600" : "text-red-600"}`}>{bankTxn.type === "credit" ? "+" : "-"}{formatBRL(bankTxn.amount)}</span>
                    <Button size="sm" onClick={() => setCreateModalTxn(bankTxn)}><PlusCircle size={15} />Criar lançamento</Button>
                    <Button size="sm" variant="ghost" onClick={() => handleIgnore(bankTxn)}><Ban size={15} />Ignorar</Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "somente-erp" && (
          <div className="divide-y divide-gray-100">
            {filterBySearch(erpOnly).length === 0 ? (
              <EmptyState text="Nenhum lançamento do ERP sem correspondência no banco." />
            ) : (
              filterBySearch(erpOnly).map((t) => (
                <div key={t.id} className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{t.description} <span className="text-xs text-gray-500">— {t.company}</span></p>
                    <p className="text-xs text-gray-500">{t.type === "payable" ? "Pagar" : "Receber"} • Vencimento {formatDate(t.dueDate)} {t.paymentDate ? `• Pago em ${formatDate(t.paymentDate)}` : ""}</p>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{formatBRL(t.amount)}</span>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "duplicidades" && (
          <div className="divide-y divide-gray-100">
            {duplicateGroups.length === 0 ? (
              <EmptyState text="Nenhuma possível duplicidade detectada." />
            ) : (
              duplicateGroups.map((group, index) => (
                <div key={index} className="p-4">
                  <div className="mb-2 flex items-center gap-2 text-amber-700"><AlertTriangle size={16} /><p className="text-sm font-semibold">Possível duplicidade — {group.length} transações idênticas</p></div>
                  <div className="space-y-2">
                    {group.map((t) => (
                      <div key={t.id} className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-sm">
                        <span>{formatDate(t.transactionDate)} • {t.description}</span>
                        <span className="font-semibold">{formatBRL(t.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "conciliadas" && (
          <div className="divide-y divide-gray-100">
            {filterBySearch(reconciled).length === 0 ? (
              <EmptyState text="Nenhuma transação conciliada ainda." />
            ) : (
              filterBySearch(reconciled).map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={17} className="text-emerald-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t.description}</p>
                      <p className="text-xs text-gray-500">{formatDate(t.transactionDate)}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{formatBRL(t.amount)}</span>
                </div>
              ))
            )}
          </div>
        )}
      </Card>

      {createModalTxn && (
        <CreateFromBankModal
          bankTxn={createModalTxn}
          categories={categories}
          costCenters={costCenters}
          onClose={() => setCreateModalTxn(null)}
          onCreate={(data) => {
            const erpTxn = addErpTransaction(data);
            linkToBankTransaction(erpTxn.id, createModalTxn.id);
            reconcileTransactions([createModalTxn.id], [erpTxn.id]);
            classifyBankTransaction(createModalTxn.id, { categoryId: data.categoryId, costCenterId: data.costCenterId });
            toast.success("Lançamento criado e conciliado.");
            setCreateModalTxn(null);
          }}
        />
      )}
    </div>
  );
}

function ConfidenceBadge({ candidate }: { candidate: MatchCandidate }) {
  const styles = {
    alta: "bg-emerald-50 text-emerald-700",
    media: "bg-amber-50 text-amber-700",
    baixa: "bg-gray-100 text-gray-600",
  } as const;
  const labels = { alta: "Alta confiança", media: "Média confiança", baixa: "Baixa confiança" } as const;
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${styles[candidate.confidence]}`}>{candidate.score}% • {labels[candidate.confidence]}</span>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="flex items-center gap-2 p-10 text-center text-sm text-gray-500"><ArrowLeftRight size={16} className="mx-auto" />{text}</div>;
}

function CreateFromBankModal({
  bankTxn, categories, costCenters, onClose, onCreate,
}: {
  bankTxn: BankTransaction;
  categories: { id: string; name: string; group: string }[];
  costCenters: { id: string; name: string }[];
  onClose: () => void;
  onCreate: (data: FinanceFormData) => void;
}) {
  const isCredit = bankTxn.type === "credit";
  const [description, setDescription] = useState(bankTxn.description);
  const [company, setCompany] = useState(bankTxn.counterparty || "");
  const [category, setCategory] = useState(bankTxn.categoryId || (isCredit ? "cat-outras-receitas" : "cat-nao-classificado"));
  const [costCenter, setCostCenter] = useState(costCenters[0]?.id || "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !company) { toast.error("Preencha descrição e cliente/fornecedor."); return; }
    onCreate({
      type: isCredit ? "receivable" : "payable",
      description,
      company,
      category: categories.find((c) => c.id === category)?.name || category,
      categoryId: category || undefined,
      costCenter: costCenters.find((c) => c.id === costCenter)?.name,
      costCenterId: costCenter || undefined,
      amount: bankTxn.amount,
      dueDate: bankTxn.transactionDate,
      paymentDate: bankTxn.transactionDate,
      status: "paid",
      bankAccount: "",
      bankAccountId: bankTxn.bankAccountId,
      document: bankTxn.documentNumber,
    });
  };

  return (
    <Modal open onClose={onClose} title={`Criar lançamento (${isCredit ? "Receita" : "Despesa"})`}>
      <form onSubmit={submit} className="space-y-4">
        <Input label="Descrição *" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Input label={isCredit ? "Cliente *" : "Fornecedor *"} value={company} onChange={(e) => setCompany(e.target.value)} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Categoria</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm">
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Centro de custo</label>
            <select value={costCenter} onChange={(e) => setCostCenter(e.target.value)} className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm">
              {costCenters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
          Data: {formatDate(bankTxn.transactionDate)} • Valor: <span className="font-semibold">{formatBRL(bankTxn.amount)}</span>
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit">Salvar e conciliar</Button>
        </div>
      </form>
    </Modal>
  );
}
