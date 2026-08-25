import { useRef, useState } from "react";
import { UploadCloud, FileWarning, CheckCircle2, AlertTriangle, Building2 } from "lucide-react";
import toast from "react-hot-toast";
import Card from "../../shared/ui/Card";
import Button from "../../shared/ui/Button";
import { useBankStore } from "../../store/useBankStore";
import { formatBRL, formatDate } from "../../shared/utils/formatters";
import { ImportBatch } from "../../types/bank";

export default function ImportarExtrato() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [lastBatch, setLastBatch] = useState<ImportBatch | null>(null);
  const importOfxFile = useBankStore((s) => s.importOfxFile);
  const importBatches = useBankStore((s) => s.importBatches);
  const bankAccounts = useBankStore((s) => s.bankAccounts);

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".ofx")) {
      toast.error("Por enquanto apenas arquivos .OFX são suportados. Envie o extrato exportado pelo internet banking.");
      return;
    }
    const content = await file.text();
    const batch = importOfxFile(content, file.name);
    setLastBatch(batch);
    if (batch.status === "failed") {
      toast.error("Não foi possível importar o extrato. Veja os detalhes abaixo.");
    } else if (batch.status === "completed_with_warnings") {
      toast.success(`Importação concluída com alertas: ${batch.importedCount} transações importadas.`);
    } else {
      toast.success(`${batch.importedCount} transações importadas com sucesso.`);
    }
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-gray-500">Conciliação bancária</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Importar Extrato Bancário</h1>
      </div>

      <Card>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`m-5 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition ${dragOver ? "border-blue-500 bg-blue-50" : "border-gray-300"}`}
        >
          <UploadCloud size={36} className="text-blue-600" />
          <p className="text-sm font-medium text-gray-900">Arraste o arquivo do extrato aqui ou clique para selecionar</p>
          <p className="text-xs text-gray-500">Formato suportado nesta versão: OFX (Open Financial Exchange). O processamento é 100% local — nenhum dado é enviado a serviços externos.</p>
          <input
            ref={inputRef}
            type="file"
            accept=".ofx"
            className="hidden"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); e.target.value = ""; }}
          />
          <Button onClick={() => inputRef.current?.click()}>Selecionar arquivo .OFX</Button>
        </div>
      </Card>

      {lastBatch && <ImportResult batch={lastBatch} />}

      {bankAccounts.length > 0 && (
        <Card title="Contas bancárias" description="Identificadas a partir dos extratos importados">
          <div className="divide-y divide-gray-100">
            {bankAccounts.map((acc) => (
              <div key={acc.id} className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-50 p-2 text-blue-600"><Building2 size={17} /></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{acc.bankName}</p>
                    <p className="text-xs text-gray-500">Banco {acc.bankCode} • Conta {acc.accountNumber}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{formatBRL(acc.currentBankBalance)}</p>
                  <p className="text-xs text-gray-500">Última importação: {acc.lastImportedDate ? formatDate(acc.lastImportedDate) : "—"}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {importBatches.length > 0 && (
        <Card title="Histórico de importações">
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left">
                  <th className="px-4 py-3 text-xs uppercase text-gray-500">Arquivo</th>
                  <th className="px-4 py-3 text-xs uppercase text-gray-500">Data</th>
                  <th className="px-4 py-3 text-xs uppercase text-gray-500">Total</th>
                  <th className="px-4 py-3 text-xs uppercase text-gray-500">Importadas</th>
                  <th className="px-4 py-3 text-xs uppercase text-gray-500">Duplicadas</th>
                  <th className="px-4 py-3 text-xs uppercase text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {importBatches.map((batch) => (
                  <tr key={batch.id}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{batch.filename}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{new Date(batch.importedAt).toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{batch.totalRows}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{batch.importedCount}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{batch.duplicateCount}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={batch.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: ImportBatch["status"] }) {
  if (status === "completed") return <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"><CheckCircle2 size={13} />Concluída</span>;
  if (status === "completed_with_warnings") return <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"><AlertTriangle size={13} />Concluída com alertas</span>;
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700"><FileWarning size={13} />Falhou</span>;
}

function ImportResult({ batch }: { batch: ImportBatch }) {
  return (
    <Card title="Revisão da Importação" description={batch.filename}>
      <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
        <Stat label="Total no arquivo" value={String(batch.totalRows)} />
        <Stat label="Importadas" value={String(batch.importedCount)} tone="text-emerald-600" />
        <Stat label="Duplicadas" value={String(batch.duplicateCount)} tone="text-amber-600" />
        <Stat label="Com erro" value={String(batch.errorCount)} tone={batch.errorCount > 0 ? "text-red-600" : undefined} />
      </div>
      {(batch.periodStart || batch.statementBalance !== undefined) && (
        <div className="grid grid-cols-1 gap-4 border-t border-gray-100 p-5 sm:grid-cols-3">
          {batch.periodStart && batch.periodEnd && (
            <div>
              <p className="text-xs text-gray-500">Período do extrato</p>
              <p className="text-sm font-medium text-gray-900">{formatDate(batch.periodStart)} a {formatDate(batch.periodEnd)}</p>
            </div>
          )}
          {batch.statementBalance !== undefined && (
            <div>
              <p className="text-xs text-gray-500">Saldo informado pelo banco</p>
              <p className="text-sm font-medium text-gray-900">{formatBRL(batch.statementBalance)}</p>
            </div>
          )}
          {batch.calculatedBalance !== undefined && (
            <div>
              <p className="text-xs text-gray-500">Saldo calculado (inicial + créditos − débitos)</p>
              <p className={`text-sm font-medium ${batch.balanceDivergence && Math.abs(batch.balanceDivergence) > 0.01 ? "text-red-600" : "text-gray-900"}`}>{formatBRL(batch.calculatedBalance)}</p>
            </div>
          )}
        </div>
      )}
      {batch.warnings.length > 0 && (
        <div className="space-y-2 border-t border-gray-100 p-5">
          {batch.warnings.map((warning, index) => (
            <div key={index} className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${tone || "text-gray-900"}`}>{value}</p>
    </div>
  );
}
