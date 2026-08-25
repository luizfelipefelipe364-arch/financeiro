import { InputHTMLAttributes } from "react";
import { cn } from "../utils/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function Input({ label, error, className, id, ...props }: InputProps) {
  const inputId = id || `input-${label?.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="space-y-1.5">
      {label && <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">{label}</label>}
      <input {...props} id={inputId}
        className={cn(
          "h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100",
          error && "border-red-400 focus:border-red-500 focus:ring-red-100", className
        )} />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}