/**
 * ExportButtons - JSON and CSV export functionality
 */

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function ExportButtons({ module }) {
  const [exporting, setExporting] = useState(false);

  const downloadFile = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportJSON = async () => {
    setExporting(true);
    try {
      const url = module
        ? `${BACKEND_URL}/api/export/json?module=${module}`
        : `${BACKEND_URL}/api/export/json`;
      const res = await fetch(url);
      const blob = await res.blob();
      const date = new Date().toISOString().split("T")[0];
      downloadFile(blob, `${module || "pineapple"}-export-${date}.json`);
      toast.success("JSON exported");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const exportCSV = async () => {
    if (!module) return;
    setExporting(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/export/csv/${module}`);
      if (!res.ok) throw new Error("No data");
      const blob = await res.blob();
      const date = new Date().toISOString().split("T")[0];
      downloadFile(blob, `${module}-export-${date}.csv`);
      toast.success("CSV exported");
    } catch {
      toast.error("Export failed or no data");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5" data-testid="export-buttons">
      <Button
        variant="ghost"
        size="sm"
        onClick={exportJSON}
        disabled={exporting}
        className="text-zinc-500 hover:text-zinc-300 text-xs h-7 px-2"
        data-testid="export-json-btn"
      >
        {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
        <span className="ml-1">JSON</span>
      </Button>
      {module && (
        <Button
          variant="ghost"
          size="sm"
          onClick={exportCSV}
          disabled={exporting}
          className="text-zinc-500 hover:text-zinc-300 text-xs h-7 px-2"
          data-testid="export-csv-btn"
        >
          {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
          <span className="ml-1">CSV</span>
        </Button>
      )}
    </div>
  );
}
