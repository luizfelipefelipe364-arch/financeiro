import { create } from "zustand";
import { persist } from "zustand/middleware";

// Customer/Supplier master data. Kept in its own store (separate from
// useFinanceStore and useBankStore) because both Accounts Payable/Receivable
// AND the reconciliation engine's counterparty matching need to reference
// the same registry — this is the single source of truth for "who".

export interface Customer {
  id: string;
  name: string;
  document: string; // CPF/CNPJ
  email?: string;
  phone?: string;
  address?: string;
  active: boolean;
  notes?: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  document: string; // CPF/CNPJ
  email?: string;
  phone?: string;
  address?: string;
  active: boolean;
  notes?: string;
  createdAt: string;
}

export type CustomerFormData = Omit<Customer, "id" | "createdAt">;
export type SupplierFormData = Omit<Supplier, "id" | "createdAt">;

interface RegistryState {
  customers: Customer[];
  suppliers: Supplier[];

  addCustomer: (data: CustomerFormData) => Customer;
  updateCustomer: (id: string, data: Partial<CustomerFormData>) => void;
  deleteCustomer: (id: string) => void;
  getCustomer: (id: string) => Customer | undefined;

  addSupplier: (data: SupplierFormData) => Supplier;
  updateSupplier: (id: string, data: Partial<SupplierFormData>) => void;
  deleteSupplier: (id: string) => void;
  getSupplier: (id: string) => Supplier | undefined;
}

const genId = (prefix: string): string => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const useRegistryStore = create<RegistryState>()(
  persist(
    (set, get) => ({
      customers: [],
      suppliers: [],

      addCustomer: (data: CustomerFormData) => {
        const created: Customer = { ...data, id: genId("CLI"), createdAt: new Date().toISOString() };
        set((state) => ({ customers: [created, ...state.customers] }));
        return created;
      },
      updateCustomer: (id: string, data: Partial<CustomerFormData>) =>
        set((state) => ({ customers: state.customers.map((c) => (c.id === id ? { ...c, ...data } : c)) })),
      deleteCustomer: (id: string) =>
        set((state) => ({ customers: state.customers.filter((c) => c.id !== id) })),
      getCustomer: (id: string) => get().customers.find((c) => c.id === id),

      addSupplier: (data: SupplierFormData) => {
        const created: Supplier = { ...data, id: genId("FOR"), createdAt: new Date().toISOString() };
        set((state) => ({ suppliers: [created, ...state.suppliers] }));
        return created;
      },
      updateSupplier: (id: string, data: Partial<SupplierFormData>) =>
        set((state) => ({ suppliers: state.suppliers.map((s) => (s.id === id ? { ...s, ...data } : s)) })),
      deleteSupplier: (id: string) =>
        set((state) => ({ suppliers: state.suppliers.filter((s) => s.id !== id) })),
      getSupplier: (id: string) => get().suppliers.find((s) => s.id === id),
    }),
    { name: "fin-erp-registry-storage" }
  )
);
