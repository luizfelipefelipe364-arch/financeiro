import { useState } from "react";
import { Bell, ChevronDown, Menu, Search } from "lucide-react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Sidebar from "./shared/ui/Sidebar";
import Dashboard from "./components/Dashboard";
import ContasAPagar from "./components/ContasAPagar";
import ContasAReceber from "./components/ContasAReceber";
import Conciliacao from "./modules/reconciliation/Conciliacao";
import ImportarExtrato from "./modules/banking/ImportarExtrato";
import FechamentoDiario from "./modules/closing/FechamentoDiario";
import Cadastros from "./components/Cadastros";
import ParametrosPage from "./components/ParametrosPage";

const titles:Record<string,string>={"/":"Dashboard","/contas-a-pagar":"Contas a Pagar","/contas-a-receber":"Contas a Receber","/importar-extrato":"Importar Extrato","/conciliacao":"Conciliação","/fechamento":"Fechamento Diário","/cadastros":"Cadastros","/parametros":"Parâmetros"};

function Layout(){
 const [open,setOpen]=useState(false),location=useLocation();
 return <div className="min-h-screen bg-gray-50"><Sidebar open={open} onClose={()=>setOpen(false)}/><div className="lg:ml-64"><header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white/95 px-4 backdrop-blur md:px-6 lg:px-8"><div className="flex items-center gap-3"><button onClick={()=>setOpen(true)} className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 lg:hidden"><Menu size={21}/></button><h1 className="hidden text-sm font-semibold text-gray-900 sm:block">{titles[location.pathname]||"FinERP"}</h1></div><div className="hidden max-w-md flex-1 px-8 md:block"><div className="relative"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input placeholder="Pesquisar no financeiro..." className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:bg-white"/></div></div><div className="flex items-center gap-2"><button className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100"><Bell size={19}/><span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"/></button><div className="hidden h-7 w-px bg-gray-200 sm:block"/><button className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-gray-50"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">GJ</div><div className="hidden text-left md:block"><p className="text-xs font-semibold">Administrador</p><p className="text-[10px] text-gray-500">Financeiro</p></div><ChevronDown size={15} className="hidden text-gray-400 md:block"/></button></div></header><main className="p-4 md:p-6 lg:p-8"><Routes><Route path="/" element={<Dashboard/>}/><Route path="/contas-a-pagar" element={<ContasAPagar/>}/><Route path="/contas-a-receber" element={<ContasAReceber/>}/><Route path="/importar-extrato" element={<ImportarExtrato/>}/><Route path="/conciliacao" element={<Conciliacao/>}/><Route path="/fechamento" element={<FechamentoDiario/>}/><Route path="/cadastros" element={<Cadastros/>}/><Route path="/parametros" element={<ParametrosPage/>}/></Routes></main></div></div>;
}
export default function App(){return <BrowserRouter><Layout/><Toaster position="top-right" toastOptions={{duration:3000}}/></BrowserRouter>}
