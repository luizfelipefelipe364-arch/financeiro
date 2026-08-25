import { useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, Lock, Unlock } from "lucide-react";
import toast from "react-hot-toast";
import Card from "../../shared/ui/Card";
import Button from "../../shared/ui/Button";
import Modal from "../../shared/ui/Modal";
import Input from "../../shared/ui/Input";
import { useBankStore } from "../../store/useBankStore";
import { useFinanceStore } from "../../store/useFinanceStore";
import { formatBRL, formatDate } from "../../shared/utils/formatters";
import { calcErpBalance, todayIso } from "../../services/bankKpis";

export default function FechamentoDiario() {
  const bankAccounts = useBankStore((s) => s.bankAccounts);
  const bankTransactions = useBankStore((s) => s.bankTransactions);
  const closeDay = useBankStore((s) => s.closeDay);
  const reopenDay = useBankStore((s) => s.reopenDay);
  const getDayStatus = useBankStore((s) => s.getDayStatus);
  const erpTransactions = useFinanceStore((s) => s.transactions);

  const [bankAccountId, setBankAccountId] = useState(bankAccounts[0]?.id || "");
  const [date, setDate] = useState(todayIso());
  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");

  const account = bankAccounts.find((a) => a.id === bankAccountId);

  const dayTxns = useMemo(
    () => bankTransactions.filter((t) => t.bankAccountId === bankAccountId && t.transactionDate === date),
    [bankTransactions, bankAccountId, date]
  );

  const closing = getDayStatus(bankAccountId, date);

  const entradas = dayTxns.filter((t) => t.type === "credit").reduce((s, t) => s + t.amount, 0);
  const saidas = dayTxns.filter((t) => t.type === "debit").reduce((s, t) => s + t.amount, 0);
  const reconciled = dayTxns.filter((t) => t.reconciliationStatus === "reconciled" || t.reconciliationStatus === "manually_reconciled").length;
  const pending = dayTxns.length - reconciled;
  const somenteNoBanco = dayTxns.filter((t) => t.reconciliationStatus === "unreconciled").length;

  const bankBalance = account?.currentBankBalance ?? 0;
  const erpBalance = calcErpBalance(erpTransactions, bankAccountId);
  const difference = Math.round((bankBalance - erpBalance) * 100) / 100;

  const status: "green" | "yellow" | "red" = Math.abs(difference) > 0.01 ? "red" : pending > 0 ? "yellow" : "green";

  const handleClose = () => {
    if (!bankAccountId) { toast.error("Selecione uma conta bancária."); return; }
    closeDay(bankAccountId, date, {
      bankBalance,
      erpBalance,
      difference,
      totalTransactions: dayTxns.length,
      reconciledTransactions: reconciled,
      pendingTransactions: pending,
    });
    toast.success("Dia fechado com sucesso.");
  };

  const handleReopen = () => {
    if (!reopenReason.trim()) {
      toast.error("Informe o motivo da reabertura.");
      return;
    }
    reopenDay(bankAccountId, date, reopenReason.trim());
    toast("Dia reaberto para ajustes.", { icon: "🔓" });
    setReopenModalOpen(false);
    setReopenReason("");
  };

  if (bankAccounts.length === 0) {
    return (
      <div className="space-y-5">
        <div><p className="text-sm text-gray-500">Operação diária</p><h1 className="mt-1 text-2xl font-bold text-gray-900">Fechamento Diário</h1></div>
        <Card><div className="p-10 text-center text-sm text-gray-500">Importe um extrato bancário para começar a operar o fechamento diário.</div></Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div><p className="text-sm text-gray-500">Operação diária</p><h1 className="mt-1 text-2xl font-bold text-gray-900">Fechamento Diário</h1></div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Conta bancária</label>
            <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm">
              {bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.bankName} — {a.accountNumber}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Data</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm" />
          </div>
          <div className="sm:ml-auto">
            <StatusBanner status={closing?.status === "closed" ? "closed" : status} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 p-5 md:grid-cols-4">
          <Stat label="Saldo bancário" value={formatBRL(bankBalance)} />
          <Stat label="Saldo ERP" value={formatBRL(erpBalance)} />
          <Stat label="Diferença" value={formatBRL(difference)} tone={Math.abs(difference) > 0.01 ? "text-red-600" : "text-emerald-600"} />
          <Stat label="Transações do dia" value={String(dayTxns.length)} />
          <Stat label="Entradas" value={formatBRL(entradas)} tone="text-emerald-600" />
          <Stat label="Saídas" value={formatBRL(saidas)} tone="text-red-600" />
          <Stat label="Conciliadas" value={String(reconciled)} />
          <Stat label="Somente no banco" value={String(somenteNoBanco)} />
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 p-4">
          {closing?.status === "closed" ? (
            <Button variant="secondary" onClick={() => setReopenModalOpen(true)}><Unlock size={16} />Reabrir dia</Button>
          ) : (
            <Button onClick={handleClose}><Lock size={16} />Fechar dia</Button>
          )}
        </div>
      </Card>

      {dayTxns.length > 0 && (
        <Card title="Movimentações do dia">
          <div className="divide-y divide-gray-100">
            {dayTxns.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{t.description}</p>
                  <p className="text-xs text-gray-500">{formatDate(t.transactionDate)} • {t.reconciliationStatus === "reconciled" || t.reconciliationStatus === "manually_reconciled" ? "Conciliado" : "Pendente"}</p>
                </div>
                <span className={`text-sm font-semibold ${t.type === "credit" ? "text-emerald-600" : "text-red-600"}`}>{t.type === "credit" ? "+" : "-"}{formatBRL(t.amount)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
      <Modal open={reopenModalOpen} onClose={() => setReopenModalOpen(false)} title="Reabrir dia">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Reabrir um dia fechado permite alterações nos registros financeiros dessa data. Essa ação é registrada no log de auditoria e exige justificativa.
          </p>
          <Input label="Motivo da reabertura *" value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} placeholder="Ex.: correção de lançamento identificado após o fechamento" />
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <Button type="button" variant="secondary" onClick={() => setReopenModalOpen(false)}>Cancelar</Button>
            <Button type="button" variant="danger" onClick={handleReopen}><Unlock size={16} />Confirmar reabertura</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function StatusBanner({ status }: { status: "green" | "yellow" | "red" | "closed" }) {
  if (status === "closed") return <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"><Lock size={13} />Dia fechado</span>;
  if (status === "green") return <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"><CheckCircle2 size={13} />Dia conciliado</span>;
  if (status === "yellow") return <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700"><AlertTriangle size={13} />Dia em revisão</span>;
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700"><AlertTriangle size={13} />Divergência</span>;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${tone || "text-gray-900"}`}>{value}</p>
    </div>
  );
}
