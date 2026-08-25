import { useEffect } from "react";
import { BarChart3, Building2, ClipboardCheck, CreditCard, FileText, LayoutDashboard, Lock, Settings, UploadCloud, Users, Wallet, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "../utils/cn";

const navigation=[
  ["Dashboard","/",LayoutDashboard],
  ["Contas a Pagar","/contas-a-pagar",CreditCard],
  ["Contas a Receber","/contas-a-receber",Wallet],
  ["Importar Extrato","/importar-extrato",UploadCloud],
  ["Conciliação","/conciliacao",ClipboardCheck],
  ["Fechamento Diário","/fechamento",Lock],
  ["Cadastros","/cadastros",Users],
  ["Parâmetros","/parametros",Settings],
] as const;
export default function Sidebar({open,onClose}:{open:boolean;onClose:()=>void}){
 useEffect(()=>{const h=(e:KeyboardEvent)=>{if(e.key==="Escape")onClose()};document.addEventListener("keydown",h);return()=>document.removeEventListener("keydown",h)},[onClose]);
 return <><div onClick={onClose} className={`fixed inset-0 z-40 bg-gray-950/50 lg:hidden ${open?"block":"hidden"}`}/><aside className={cn("fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-gray-950 text-white transition-transform duration-300 lg:translate-x-0",open?"translate-x-0":"-translate-x-full")}><div className="flex h-16 items-center justify-between border-b border-white/10 px-5"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600"><BarChart3 size={20}/></div><div><p className="text-sm font-bold">FinERP</p><p className="text-[10px] text-gray-400">Gestão Financeira</p></div></div><button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-white/10 lg:hidden"><X size={20}/></button></div><nav className="flex-1 space-y-1 overflow-y-auto p-3"><p className="mb-3 px-3 pt-3 text-[10px] font-semibold uppercase tracking-widest text-gray-500">Gestão Financeira</p>{navigation.map(([label,path,Icon])=><NavLink key={path} to={path} end={path==="/"} onClick={onClose} className={({isActive})=>cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",isActive?"bg-blue-600 text-white":"text-gray-400 hover:bg-white/5 hover:text-white")}><Icon size={18}/><span>{label}</span></NavLink>)}</nav><div className="border-t border-white/10 p-4"><div className="flex items-center gap-3 rounded-lg bg-white/5 p-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-bold">GJ</div><div className="min-w-0"><p className="truncate text-sm font-medium">Administrador</p><p className="truncate text-xs text-gray-500">Gestor Financeiro</p></div></div><div className="mt-3 flex items-center gap-2 px-2 text-xs text-gray-500"><Building2 size={13}/>Empresa Principal</div><div className="mt-2 flex items-center gap-2 px-2 text-xs text-gray-500"><FileText size={13}/>ERP Financeiro v1.0</div></div></aside></>;
}
