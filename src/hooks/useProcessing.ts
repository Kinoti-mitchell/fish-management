import { useState, useEffect, useCallback } from "react";
import { ProcessingRecord } from "../types";

export const useProcessing = () => {
  const [records, setRecords] = useState<ProcessingRecord[]>([]);

  const fetchRecords = useCallback(async () => {
    const res = await fetch("/api/processing");
    const data: ProcessingRecord[] = await res.json();
    setRecords(data);
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const createRecord = async (record: Partial<ProcessingRecord>) => {
    const res = await fetch("/api/processing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
    const newRecord = await res.json();
    setRecords((prev) => [...prev, newRecord]);
  };

  const updateRecord = async (id: string, updates: Partial<ProcessingRecord>) => {
    const res = await fetch(`/api/processing/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const updated = await res.json();
    setRecords((prev) => prev.map((r) => (r.id === id ? updated : r)));
  };

  const deleteRecord = async (id: string) => {
    await fetch(`/api/processing/${id}`, { method: "DELETE" });
    setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  return { records, fetchRecords, createRecord, updateRecord, deleteRecord };
};
