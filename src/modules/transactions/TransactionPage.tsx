import { useMemo, useState } from "react";
import { CheckCircle2, Edit3, Plus, Search, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import Button from "../../shared/ui/Button";
import Card from "../../shared/ui/Card";
import DataTable, { DataTableColumn } from "../../shared/ui/DataTable";
import Input from "../../shared/ui/Input";
import Modal from "../../shared/ui/Modal";
import { FinanceFormData, Transaction, TransactionStatus, TransactionType, useFinanceStore } from "../../store/useFinanceStore";
import { useRegistryStore } from "../../store/useRegistryStore";
import { useBankStore } from "../../store/useBankStore";
import { formatBRL, formatDate } from "../../shared/utils/formatters";

interface TransactionPageProps {
  type: TransactionType;
  title: string;
}

const statusLabels: Record<TransactionType, Record<TransactionStatus, string>> = {
  payable: { pending: "Pendente", paid: "Pago", overdue: "Em atraso", cancelled: "Cancelado" },
  receivable: { pending: "Pendente", paid: "Recebido", overdue: "Em atraso", cancelled: "Cancelado" },
};

const statusClasses: Record<TransactionStatus, string> = {
  pending: "bg-amber-50 text-amber-700",
  paid: "bg-emerald-50 text-emerald-700",
  overdue: "bg-red-50 text-red-700",
  cancelled: "bg-gray-100 text-gray-600",
};

function emptyForm(type: TransactionType): FinanceFormData {
  return {
    type,
    description: "",
    company: "",
    category: "",
    amount: 0,
    dueDate: "",
    status: "pending",
    bankAccount: "",
  };
}

export default function TransactionPage({ type, title }: TransactionPageProps) {
  const transactions = useFinanceStore((s) => s.transactions);
  const add = useFinanceStore((s) => s.addTransaction);
  const update = useFinanceStore((s) => s.updateTransaction);
  const remove = useFinanceStore((s) => s.deleteTransaction);
  const markPaid = useFinanceStore((s) => s.markAsPaid);

  const customers = useRegistryStore((s) => s.customers.filter((c) => c.active));
  const suppliers = useRegistryStore((s) => s.suppliers.filter((s) => s.active));
  const categories = useBankStore((s) => s.categories);
  const costCenters = useBankStore((s) => s.costCenters);
  const bankAccounts = useBankStore((s) => s.bankAccounts);

  const relevantCategories = useMemo(
    () => categories.filter((c) => (type === "receivable" ? c.group === "receita" : c.group === "despesa" || c.group === "financeiro")),
    [categories, type]
  );

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | TransactionStatus>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [form, setForm] = useState<FinanceFormData>(emptyForm(type));

  const data = useMemo(
    () =>
      transactions
        .filter((t) => t.type === type)
        .filter((t) => `${t.description} ${t.company} ${t.category}`.toLowerCase().includes(search.toLowerCase()))
        .filter((t) => status === "all" || t.status === status)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [transactions, type, search, status]
  );

  const totals = useMemo(() => {
    const relevant = transactions.filter((t) => t.type === type && t.status !== "cancelled");
    const todayIso = new Date().toISOString().slice(0, 10);
    return {
      total: relevant.reduce((sum, t) => sum + t.amount, 0),
      overdue: relevant.filter((t) => t.status === "overdue").reduce((sum, t) => sum + t.amount, 0),
      today: relevant.filter((t) => t.dueDate === todayIso && t.status === "pending").reduce((sum, t) => sum + t.amount, 0),
      settled: relevant.filter((t) => t.status === "paid").reduce((sum, t) => sum + t.amount, 0),
    };
  }, [transactions, type]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm(type));
    setOpen(true);
  };

  const openEdit = (t: Transaction) => {
    setEditing(t);
    setForm({ ...t });
    setOpen(true);
  };

  const onCounterpartyChange = (id: string) => {
    if (type === "receivable") {
      const customer = customers.find((c) => c.id === id);
      setForm((f) => ({ ...f, customerId: id || undefined, company: customer?.name || "" }));
    } else {
      const supplier = suppliers.find((s) => s.id === id);
      setForm((f) => ({ ...f, supplierId: id || undefined, company: supplier?.name || "" }));
    }
  };

  const onCategoryChange = (id: string) => {
    const cat = categories.find((c) => c.id === id);
    setForm((f) => ({ ...f, categoryId: id || undefined, category: cat?.name || "" }));
  };

  const onCostCenterChange = (id: string) => {
    const cc = costCenters.find((c) => c.id === id);
    setForm((f) => ({ ...f, costCenterId: id || undefined, costCenter: cc?.name || "" }));
  };

  const onBankAccountChange = (id: string) => {
    const acc = bankAccounts.find((a) => a.id === id);
    setForm((f) => ({ ...f, bankAccountId: id || undefined, bankAccount: acc ? `${acc.bankName} - ${acc.accountName}` : "" }));
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description || !form.company || !form.dueDate || form.amount <= 0) {
      toast.error("Preencha descrição, " + (type === "payable" ? "fornecedor" : "cliente") + ", valor e vencimento.");
      return;
    }
    if (editing) update(editing.id, form);
    else add(form);
    toast.success(editing ? "Conta atualizada." : "Conta cadastrada.");
    setOpen(false);
  };

  const del = (id: string) => {
    if (confirm("Deseja realmente excluir esta conta?")) {
      remove(id);
      toast.success("Conta excluída.");
    }
  };

  const columns: DataTableColumn<Transaction>[] = [
    {
      key: "description",
      header: type === "payable" ? "Descrição / Fornecedor" : "Cliente / Descrição",
      render: (t) => (
        <div>
          <p className="font-medium text-gray-900">{t.description}</p>
          <p className="text-xs text-gray-500">{t.company}</p>
        </div>
      ),
    },
    { key: "category", header: "Categoria", render: (t) => t.category || "—" },
    { key: "costCenter", header: "Centro de Custo", render: (t) => t.costCenter || "—" },
    { key: "dueDate", header: "Vencimento", render: (t) => formatDate(t.dueDate) },
    { key: "amount", header: "Valor", className: "text-right font-semibold", render: (t) => formatBRL(t.amount) },
    { key: "status", header: "Status", render: (t) => <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses[t.status]}`}>{statusLabels[type][t.status]}</span> },
    {
      key: "actions",
      header: "Ações",
      className: "text-right",
      render: (t) => (
        <div className="flex justify-end gap-1">
          {t.status !== "paid" && t.status !== "cancelled" && (
            <button
              title={type === "payable" ? "Marcar como pago" : "Confirmar recebimento"}
              onClick={() => {
                markPaid(t.id);
                toast.success(type === "payable" ? "Conta marcada como paga." : "Recebimento confirmado.");
              }}
              className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50"
            >
              <CheckCircle2 size={16} />
            </button>
          )}
          <button title="Editar" onClick={() => openEdit(t)} className="rounded-lg p-2 text-blue-600 hover:bg-blue-50">
            <Edit3 size={16} />
          </button>
          <button title="Excluir" onClick={() => del(t.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50">
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  const counterpartyOptions = type === "receivable" ? customers : suppliers;
  const noCounterparties = counterpartyOptions.length === 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-gray-500">Gestão financeira</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">{title}</h1>
        </div>
        <Button onClick={openNew}>
          <Plus size={17} />
          Nova conta
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5"><p className="text-xs text-gray-500">Total em aberto</p><p className="mt-1 text-xl font-bold text-gray-900">{formatBRL(totals.total)}</p></Card>
        <Card className="p-5"><p className="text-xs text-gray-500">Vencendo hoje</p><p className="mt-1 text-xl font-bold text-amber-600">{formatBRL(totals.today)}</p></Card>
        <Card className="p-5"><p className="text-xs text-gray-500">Em atraso</p><p className="mt-1 text-xl font-bold text-red-600">{formatBRL(totals.overdue)}</p></Card>
        <Card className="p-5"><p className="text-xs text-gray-500">{type === "payable" ? "Pago" : "Recebido"}</p><p className="mt-1 text-xl font-bold text-emerald-600">{formatBRL(totals.settled)}</p></Card>
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 md:flex-row">
          <div className="relative flex-1">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="h-10 w-full rounded-lg border border-gray-300 pl-10 pr-3 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value as "all" | TransactionStatus)} className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm">
            <option value="all">Todos os status</option>
            <option value="pending">Pendente</option>
            <option value="paid">{type === "payable" ? "Pago" : "Recebido"}</option>
            <option value="overdue">Em atraso</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
        <DataTable columns={columns} data={data} rowKey={(t) => t.id} />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Editar ${type === "payable" ? "conta a pagar" : "conta a receber"}` : `Nova ${type === "payable" ? "conta a pagar" : "conta a receber"}`}>
        <form onSubmit={save} className="space-y-4">
          <Input label="Descrição *" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{type === "payable" ? "Fornecedor *" : "Cliente *"}</label>
            {noCounterparties ? (
              <p className="rounded-lg border border-dashed border-gray-300 p-3 text-xs text-gray-500">
                Nenhum {type === "payable" ? "fornecedor" : "cliente"} cadastrado.{" "}
                <Link to="/cadastros" className="font-medium text-blue-600 hover:underline">
                  Criar cadastro
                </Link>
              </p>
            ) : (
              <select
                value={type === "payable" ? form.supplierId || "" : form.customerId || ""}
                onChange={(e) => onCounterpartyChange(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm"
              >
                <option value="">Selecione...</option>
                {counterpartyOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Categoria</label>
              <select value={form.categoryId || ""} onChange={(e) => onCategoryChange(e.target.value)} className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm">
                <option value="">Não classificado</option>
                {relevantCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Centro de Custo</label>
              <select value={form.costCenterId || ""} onChange={(e) => onCostCenterChange(e.target.value)} className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm">
                <option value="">Não definido</option>
                {costCenters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <Input label="Valor *" type="number" min="0" step="0.01" value={form.amount || ""} onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))} />
            <Input label="Vencimento *" type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as TransactionStatus }))} className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm">
                <option value="pending">Pendente</option>
                <option value="paid">{type === "payable" ? "Pago" : "Recebido"}</option>
                <option value="overdue">Em atraso</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Conta Bancária</label>
              {bankAccounts.length === 0 ? (
                <Input value={form.bankAccount} onChange={(e) => setForm((f) => ({ ...f, bankAccount: e.target.value }))} placeholder="Nenhuma conta importada ainda" />
              ) : (
                <select value={form.bankAccountId || ""} onChange={(e) => onBankAccountChange(e.target.value)} className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm">
                  <option value="">Selecione...</option>
                  {bankAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.bankName} - {a.accountName}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <Input label="Documento" value={form.document || ""} onChange={(e) => setForm((f) => ({ ...f, document: e.target.value }))} />
            <Input label="Observações" value={form.notes || ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar conta</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
