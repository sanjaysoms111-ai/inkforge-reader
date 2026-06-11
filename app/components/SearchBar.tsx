"use client";

import { Search, X } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = "Search titles or creators..." }: Props) {
  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input w-full rounded-xl py-2.5 pl-10 pr-10 text-sm placeholder:text-zinc-500 focus:ring-1 focus:ring-rose-600"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-3 top-3 rounded p-0.5 text-zinc-400 hover:bg-zinc-800"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}
