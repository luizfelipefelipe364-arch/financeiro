import { ReactNode } from "react";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  className?: string;
  render?: (item: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  emptyMessage?: string;
  rowKey: (item: T) => string;
}

export default function DataTable<T>({ columns, data, emptyMessage = "Nenhum registro encontrado.", rowKey }: DataTableProps<T>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="min-w-[800px] w-full border-collapse text-left">
        <thead><tr className="border-b border-gray-200 bg-gray-50">
          {columns.map((column) => <th key={column.key} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 ${column.className || ""}`}>{column.header}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-gray-100">
          {data.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-gray-500">{emptyMessage}</td></tr>
          ) : data.map((item) => (
            <tr key={rowKey(item)} className="transition hover:bg-gray-50">
              {columns.map((column) => <td key={column.key} className={`px-4 py-3 text-sm text-gray-700 ${column.className || ""}`}>
                {column.render ? column.render(item) : String((item as Record<string, unknown>)[column.key] ?? "")}
              </td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}