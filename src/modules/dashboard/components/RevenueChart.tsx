import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Card from "../../../shared/ui/Card";
import { formatBRL } from "../../../shared/utils/formatters";
import { Transaction } from "../../../store/useFinanceStore";

export default function RevenueChart({ transactions }: { transactions: Transaction[] }) {
  const months=["Mar","Abr","Mai","Jun","Jul","Ago"];
  const revenue=transactions.filter(t=>t.type==="receivable").reduce((s,t)=>s+t.amount,0);
  const expense=transactions.filter(t=>t.type==="payable").reduce((s,t)=>s+t.amount,0);
  const data=months.map((month,index)=>({month, receitas:Math.round(revenue*(0.72+index*0.055)), despesas:Math.round(expense*(0.7+index*0.045))}));
  return <Card title="Receitas x Despesas" description="Evolução financeira dos últimos meses"><div className="h-[320px] p-5"><ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="month" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false} tickFormatter={v=>`${Math.round(v/1000)}k`}/><Tooltip formatter={(value:number)=>formatBRL(value)} contentStyle={{borderRadius:10,border:"1px solid #e5e7eb"}}/><Legend/><Bar dataKey="receitas" name="Receitas" radius={[5,5,0,0]} fill="#2563eb"/><Bar dataKey="despesas" name="Despesas" radius={[5,5,0,0]} fill="#ef4444"/></BarChart></ResponsiveContainer></div></Card>;
}