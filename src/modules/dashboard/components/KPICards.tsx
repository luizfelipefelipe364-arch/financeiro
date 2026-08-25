import { ArrowDownRight, ArrowUpRight, Clock3, Wallet } from "lucide-react";
import Card from "../../../shared/ui/Card";
import { formatBRL, formatPercentage } from "../../../shared/utils/formatters";
import { Transaction } from "../../../store/useFinanceStore";

export default function KPICards({ transactions }: { transactions: Transaction[] }) {
  const receivables = transactions.filter(t => t.type === "receivable" && t.status !== "cancelled").reduce((s,t)=>s+t.amount,0);
  const payables = transactions.filter(t => t.type === "payable" && t.status !== "cancelled").reduce((s,t)=>s+t.amount,0);
  const overdue = transactions.filter(t => t.status === "overdue").reduce((s,t)=>s+t.amount,0);
  const paidReceivables = transactions.filter(t => t.type === "receivable" && t.status === "paid").reduce((s,t)=>s+t.amount,0);
  const paidPayables = transactions.filter(t => t.type === "payable" && t.status === "paid").reduce((s,t)=>s+t.amount,0);
  const balance = paidReceivables - paidPayables;
  const cards = [
    { title:"Saldo realizado", value:formatBRL(balance), subtitle:"Receitas pagas - despesas pagas", icon:Wallet, positive:balance>=0 },
    { title:"Contas a receber", value:formatBRL(receivables), subtitle:`${formatBRL(paidReceivables)} já recebido`, icon:ArrowUpRight, positive:true },
    { title:"Contas a pagar", value:formatBRL(payables), subtitle:`${formatBRL(paidPayables)} já pago`, icon:ArrowDownRight, positive:false },
    { title:"Em atraso", value:formatBRL(overdue), subtitle:`${formatPercentage(overdue/Math.max(receivables+payables,1))} da carteira`, icon:Clock3, positive:false }
  ];
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">{cards.map(card => { const Icon=card.icon; return <Card key={card.title} className="p-5"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-gray-500">{card.title}</p><p className="mt-2 text-2xl font-bold tracking-tight text-gray-900">{card.value}</p></div><div className={`rounded-lg p-2.5 ${card.positive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}><Icon size={20}/></div></div><p className="mt-3 text-xs text-gray-500">{card.subtitle}</p></Card> })}</div>;
}