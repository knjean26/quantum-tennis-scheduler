"use client";
import { useState, useRef, useEffect, useMemo } from "react";

export default function Combobox({
  label,
  value,
  options,
  onChange,
  placeholder = "Type to search...",
  required = false,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [inputVal, setInputVal] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setInputVal(value); }, [value]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    const q = inputVal.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [inputVal, options]);

  function handleInput(v: string) {
    setInputVal(v);
    onChange(v);
    setOpen(true);
  }

  function handleSelect(opt: string) {
    setInputVal(opt);
    onChange(opt);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type="text"
        value={inputVal}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-400 italic">
              {inputVal ? `"${inputVal}" will be added as new` : "No options"}
            </div>
          ) : (
            filtered.map((opt) => (
              <div
                key={opt}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(opt); }}
                className="px-3 py-2 text-sm cursor-pointer hover:bg-emerald-50 hover:text-emerald-800"
              >
                {opt}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
