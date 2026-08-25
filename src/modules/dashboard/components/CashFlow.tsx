import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Card from "../../../shared/ui/Card";
import { formatBRL } from "../../../shared/utils/formatters";
import { Transaction } from "../../../store/useFinanceStore";

export default function CashFlow({ transactions }: { transactions: Transaction[] }) {
  const receivable=transactions.filter(t=>t.type==="receivable").reduce((s,t)=>s+t.amount,0);
  const payable=transactions.filter(t=>t.type==="payable").reduce((s,t)=>s+t.amount,0);
  const data=[{day:"01",saldo:82000},{day:"05",saldo:105000},{day:"10",saldo:89000},{day:"15",saldo:137000},{day:"20",saldo:119000},{day:"25",saldo:154000},{day:"30",saldo:Math.max(154000+receivable-payable,0)}];
  return <Card title="Projeção de Caixa" description="Visão consolidada do saldo projetado"><div className="h-[320px] p-5"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data}><defs><linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/><stop offset="95%" stopColor="#2563eb" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="day" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false} tickFormatter={v=>`${Math.round(v/1000)}k`}/><Tooltip formatter={(value:number)=>formatBRL(value)} contentStyle={{borderRadius:10,border:"1px solid #e5e7eb"}}/><Area type="monotone" dataKey="saldo" name="Saldo" stroke="#2563eb" strokeWidth={2} fill="url(#cashGradient)"/></AreaChart></ResponsiveContainer></div></Card>;
}