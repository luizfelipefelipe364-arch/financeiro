import { ArrowRight, AlertCircle, CheckCircle2, Landmark, ArrowUpRight, ArrowDownRight, ClipboardCheck } from "lucide-react";
import { Link } from "react-router-dom";
import Card from "../shared/ui/Card";
import Button from "../shared/ui/Button";
import { useFinanceStore } from "../store/useFinanceStore";
import { useBankStore } from "../store/useBankStore";
import { formatBRL, formatDate, formatPercentage } from "../shared/utils/formatters";
import KPICards from "../modules/dashboard/components/KPICards";
import RevenueChart from "../modules/dashboard/components/RevenueChart";
import CashFlow from "../modules/dashboard/components/CashFlow";
import { calcErpBalance, calcOverallBankBalance, calcReconciliationStats, calcTodayInflowOutflow, todayIso } from "../services/bankKpis";

export default function Dashboard() {
  const transactions=useFinanceStore(s=>s.transactions);
  const bankAccounts=useBankStore(s=>s.bankAccounts);
  const bankTransactions=useBankStore(s=>s.bankTransactions);
  const overdue=transactions.filter(t=>t.status==="overdue");
  const upcoming=transactions.filter(t=>t.status==="pending").sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).slice(0,5);

  const hasBankData = bankAccounts.length > 0;
  const bankBalance = calcOverallBankBalance(bankAccounts);
  const erpBalance = calcErpBalance(transactions);
  const difference = Math.round((bankBalance - erpBalance) * 100) / 100;
  const today = todayIso();
  const { inflow, outflow } = calcTodayInflowOutflow(bankTransactions, today);
  const reconStats = calcReconciliationStats(bankTransactions);

  return <div className="space-y-6">
    <div><p className="text-sm text-gray-500">Visão geral financeira</p><h1 className="mt-1 text-2xl font-bold text-gray-900">Dashboard</h1></div>

    {hasBankData && (
      <Card title="Status Bancário" description="Situação em tempo real, calculada a partir dos extratos importados">
        <div className="grid grid-cols-2 gap-4 p-5 md:grid-cols-3 xl:grid-cols-6">
          <BankStat icon={Landmark} label="Saldo Bancário" value={formatBRL(bankBalance)} />
          <BankStat icon={Landmark} label="Saldo ERP" value={formatBRL(erpBalance)} />
          <BankStat icon={difference===0?CheckCircle2:AlertCircle} label="Diferença" value={formatBRL(difference)} tone={Math.abs(difference)>0.01?"text-red-600":"text-emerald-600"} />
          <BankStat icon={ArrowUpRight} label="Entradas hoje" value={formatBRL(inflow)} tone="text-emerald-600" />
          <BankStat icon={ArrowDownRight} label="Saídas hoje" value={formatBRL(outflow)} tone="text-red-600" />
          <BankStat icon={ClipboardCheck} label="Conciliação" value={formatPercentage(reconStats.percentage)} />
        </div>
      </Card>
    )}

    <KPICards transactions={transactions}/>
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2"><RevenueChart transactions={transactions}/><CashFlow transactions={transactions}/></div>
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <Card title="Contas em atraso" description="Registros que exigem ação" action={<Link to="/contas-a-receber"><Button variant="ghost" size="sm">Ver todos <ArrowRight size={14}/></Button></Link>}>
        <div className="divide-y divide-gray-100">{overdue.length===0 ? <div className="flex items-center gap-3 p-5 text-sm text-emerald-600"><CheckCircle2 size={18}/>Nenhuma conta em atraso.</div> : overdue.map(item=><div key={item.id} className="flex items-center justify-between gap-4 p-4"><div className="flex min-w-0 items-center gap-3"><div className="rounded-lg bg-red-50 p-2 text-red-600"><AlertCircle size={17}/></div><div className="min-w-0"><p className="truncate text-sm font-medium text-gray-900">{item.description}</p><p className="text-xs text-gray-500">Vencimento: {formatDate(item.dueDate)}</p></div></div><p className="whitespace-nowrap text-sm font-semibold text-red-600">{formatBRL(item.amount)}</p></div>)}</div>
      </Card>
      <Card title="Próximos vencimentos" description="Contas pendentes de pagamento ou recebimento">
        <div className="divide-y divide-gray-100">{upcoming.map(item=><div key={item.id} className="flex items-center justify-between gap-4 p-4"><div className="min-w-0"><p className="truncate text-sm font-medium text-gray-900">{item.description}</p><p className="text-xs text-gray-500">{item.type==="payable"?"Pagar":"Receber"} • {formatDate(item.dueDate)}</p></div><p className={`whitespace-nowrap text-sm font-semibold ${item.type==="payable"?"text-red-600":"text-emerald-600"}`}>{formatBRL(item.amount)}</p></div>)}</div>
      </Card>
    </div>
  </div>;
}

function BankStat({icon:Icon,label,value,tone}:{icon:any;label:string;value:string;tone?:string}){
  return <div className="flex items-start gap-3"><div className={`rounded-lg bg-gray-50 p-2 ${tone||"text-gray-600"}`}><Icon size={17}/></div><div><p className="text-xs text-gray-500">{label}</p><p className={`mt-0.5 text-sm font-bold ${tone||"text-gray-900"}`}>{value}</p></div></div>;
}
