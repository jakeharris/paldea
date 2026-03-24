import { useRef, useState, useEffect } from "react";
import { useLeagueDispatch } from "@/context/league-context";

const STORAGE_KEY = "paldea-leagues";

export function DataMenu() {
  const dispatch = useLeagueDispatch();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function handleExport() {
    setOpen(false);
    const raw = localStorage.getItem(STORAGE_KEY) ?? "[]";
    const envelope = JSON.stringify({ version: 1, data: JSON.parse(raw) }, null, 2);
    const blob = new Blob([envelope], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "paldea-export.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    setOpen(false);
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        const leagues = Array.isArray(parsed) ? parsed : parsed?.data;
        if (!Array.isArray(leagues)) {
          alert("Invalid file: expected an array of leagues.");
          return;
        }
        if (!confirm("This will replace all current data. Continue?")) return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(leagues));
        dispatch({ type: "HYDRATE", leagues });
      } catch {
        alert("Could not parse the file. Make sure it's a valid Paldea export.");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-text-muted hover:text-text-secondary transition-colors text-sm font-mono px-2 py-1 rounded-pill hover:bg-surface-raised"
        title="Data"
        aria-label="Data menu"
      >
        ⚙
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-40 glass rounded-card shadow-lg z-50 py-1 overflow-hidden">
          <button
            onClick={handleExport}
            className="w-full text-left px-3 py-2 text-xs font-mono text-text-secondary hover:bg-surface-raised transition-colors"
          >
            Export data
          </button>
          <button
            onClick={handleImportClick}
            className="w-full text-left px-3 py-2 text-xs font-mono text-text-secondary hover:bg-surface-raised transition-colors"
          >
            Import data
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
