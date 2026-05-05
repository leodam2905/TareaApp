"use client";

import { Globe } from "lucide-react";
import { LANGUAGES, Lang } from "@/lib/i18n";
import { useT } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

export default function LanguageSelector() {
  const { lang, setLang } = useT();

  return (
    <div className="px-4 py-2">
      <div className="flex items-center gap-2 mb-2">
        <Globe className="w-4 h-4 text-slate-500 flex-shrink-0" />
        <span className="text-slate-500 text-xs font-medium uppercase tracking-wider">Language</span>
      </div>
      <div className="flex gap-1.5">
        {(Object.entries(LANGUAGES) as [Lang, { label: string; flag: string }][]).map(([code, meta]) => (
          <button
            key={code}
            onClick={() => setLang(code)}
            title={meta.label}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all",
              lang === code
                ? "bg-tarea-sky/20 text-tarea-sky border border-tarea-sky/30"
                : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
            )}
          >
            <span className="text-sm">{meta.flag}</span>
            <span>{code.toUpperCase()}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
