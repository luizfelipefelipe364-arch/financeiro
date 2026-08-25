import { useMemo, useState } from "react";
import { Edit3, Plus, Search, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import Button from "../shared/ui/Button";
import Card from "../shared/ui/Card";
import DataTable, { DataTableColumn } from "../shared/ui/DataTable";
import Input from "../shared/ui/Input";
import Modal from "../shared/ui/Modal";
import {
  Customer,
  CustomerFormData,
  Supplier,
  SupplierFormData,
  useRegistryStore,
} from "../store/useRegistryStore";
import { useFinanceStore } from "../store/useFinanceStore";

type RegistryType = "cliente" | "fornecedor";
type RegistryRow = (Customer | Supplier) & { registryType: RegistryType };

const emptyCustomer: CustomerFormData = { name: "", document: "", email: "", phone: "", address: "", active: true, notes: "" };
const emptySupplier: SupplierFormData = { name: "", document: "", email: "", phone: "", address: "", active: true, notes: "" };

export default function Cadastros() {
  const customers = useRegistryStore((s) => s.customers);
  const suppliers = useRegistryStore((s) => s.suppliers);
  const addCustomer = useRegistryStore((s) => s.addCustomer);
  const updateCustomer = useRegistryStore((s) => s.updateCustomer);
  const deleteCustomer = useRegistryStore((s) => s.deleteCustomer);
  const addSupplier = useRegistryStore((s) => s.addSupplier);
  const updateSupplier = useRegistryStore((s) => s.updateSupplier);
  const deleteSupplier = useRegistryStore((s) => s.deleteSupplier);
  const transactions = useFinanceStore((s) => s.transactions);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"Todos" | RegistryType>("Todos");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RegistryRow | null>(null);
  const [formType, setFormType] = useState<RegistryType>("cliente");
  const [customerForm, setCustomerForm] = useState<CustomerFormData>(emptyCustomer);
  const [supplierForm, setSupplierForm] = useState<SupplierFormData>(emptySupplier);

  const rows: RegistryRow[] = useMemo(
    () => [
      ...customers.map((c) => ({ ...c, registryType: "cliente" as const })),
      ...suppliers.map((s) => ({ ...s, registryType: "fornecedor" as const })),
    ],
    [customers, suppliers]
  );

  const filtered = useMemo(
    () =>
      rows
        .filter((r) => `${r.name} ${r.document}`.toLowerCase().includes(search.toLowerCase()))
        .filter((r) => typeFilter === "Todos" || r.registryType === typeFilter)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [rows, search, typeFilter]
  );

  const linkedCount = (row: RegistryRow) =>
    transactions.filter((t) => (row.registryType === "cliente" ? t.customerId === row.id : t.supplierId === row.id)).length;

  const openNew = (type: RegistryType) => {
    setEditing(null);
    setFormType(type);
    setCustomerForm(emptyCustomer);
    setSupplierForm(emptySupplier);
    setOpen(true);
  };

  const openEdit = (row: RegistryRow) => {
    setEditing(row);
    setFormType(row.registryType);
    if (row.registryType === "cliente") setCustomerForm({ ...row });
    else setSupplierForm({ ...row });
    setOpen(true);
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const form = formType === "cliente" ? customerForm : supplierForm;
    if (!form.name || !form.document) {
      toast.error("Informe nome e documento.");
      return;
    }
    if (formType === "cliente") {
      if (editing) updateCustomer(editing.id, customerForm);
      else addCustomer(customerForm);
    } else {
      if (editing) updateSupplier(editing.id, supplierForm);
      else addSupplier(supplierForm);
    }
    toast.success(editing ? "Cadastro atualizado." : "Cadastro criado.");
    setOpen(false);
  };

  const remove = (row: RegistryRow) => {
    const linked = linkedCount(row);
    if (linked > 0) {
      toast.error(`Não é possível excluir: há ${linked} conta(s) vinculada(s) a este cadastro.`);
      return;
    }
    if (!confirm(`Deseja realmente excluir "${row.name}"?`)) return;
    if (row.registryType === "cliente") deleteCustomer(row.id);
    else deleteSupplier(row.id);
    toast.success("Cadastro excluído.");
  };

  const columns: DataTableColumn<RegistryRow>[] = [
    {
      key: "name",
      header: "Nome / Razão Social",
      render: (r) => (
        <div>
          <p className="font-medium text-gray-900">{r.name}</p>
          <p className="text-xs text-gray-500">{r.document}</p>
        </div>
      ),
    },
    {
      key: "registryType",
      header: "Tipo",
      render: (r) => (
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${r.registryType === "cliente" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}`}>
          {r.registryType === "cliente" ? "Cliente" : "Fornecedor"}
        </span>
      ),
    },
    { key: "email", header: "Contato", render: (r) => <span className="text-sm text-gray-600">{r.email || r.phone || "—"}</span> },
    {
      key: "linked",
      header: "Contas vinculadas",
      render: (r) => <span className="text-sm text-gray-600">{linkedCount(r)}</span>,
    },
    {
      key: "active",
      header: "Status",
      render: (r) => (
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${r.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
          {r.active ? "Ativo" : "Inativo"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Ações",
      className: "text-right",
      render: (r) => (
        <div className="flex justify-end gap-1">
          <button title="Editar" onClick={() => openEdit(r)} className="rounded-lg p-2 text-blue-600 hover:bg-blue-50">
            <Edit3 size={16} />
          </button>
          <button title="Excluir" onClick={() => remove(r)} className="rounded-lg p-2 text-red-600 hover:bg-red-50">
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-gray-500">Dados mestres</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Cadastros</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => openNew("cliente")}>
            <Plus size={17} />
            Novo cliente
          </Button>
          <Button onClick={() => openNew("fornecedor")}>
            <Plus size={17} />
            Novo fornecedor
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-xl font-bold">{rows.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-gray-500">Clientes</p>
          <p className="text-xl font-bold">{customers.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-gray-500">Fornecedores</p>
          <p className="text-xl font-bold">{suppliers.length}</p>
        </Card>
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 md:flex-row">
          <div className="relative flex-1">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar por nome ou documento..."
              className="h-10 w-full rounded-lg border border-gray-300 pl-10 pr-3 text-sm"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as "Todos" | RegistryType)}
            className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm"
          >
            <option value="Todos">Todos</option>
            <option value="cliente">Cliente</option>
            <option value="fornecedor">Fornecedor</option>
          </select>
        </div>
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">Nenhum cadastro encontrado. Crie um cliente ou fornecedor para começar.</div>
        ) : (
          <DataTable columns={columns} data={filtered} rowKey={(r) => r.id} />
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Editar ${formType}` : `Novo ${formType}`}>
        <form onSubmit={save} className="space-y-4">
          {!editing && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo de cadastro</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as RegistryType)}
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm"
              >
                <option value="cliente">Cliente</option>
                <option value="fornecedor">Fornecedor</option>
              </select>
            </div>
          )}
          {formType === "cliente" ? (
            <RegistryFields form={customerForm} setForm={setCustomerForm} />
          ) : (
            <RegistryFields form={supplierForm} setForm={setSupplierForm} />
          )}
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar cadastro</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function RegistryFields<T extends CustomerFormData | SupplierFormData>({
  form,
  setForm,
}: {
  form: T;
  setForm: (updater: (f: T) => T) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Input label="Nome / Razão Social *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      </div>
      <Input label="CPF / CNPJ *" value={form.document} onChange={(e) => setForm((f) => ({ ...f, document: e.target.value }))} />
      <Input label="E-mail" type="email" value={form.email || ""} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
      <Input label="Telefone" value={form.phone || ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
      <Input label="Endereço" value={form.address || ""} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
      <div className="sm:col-span-2">
        <Input label="Observações" value={form.notes || ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
      </div>
      <div className="flex items-center gap-2">
        <input
          id="active-toggle"
          type="checkbox"
          checked={form.active}
          onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
          className="h-4 w-4 rounded border-gray-300"
        />
        <label htmlFor="active-toggle" className="text-sm text-gray-700">
          Cadastro ativo
        </label>
      </div>
    </div>
  );
}
