"use client";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";
import ReactMarkdown from "react-markdown";
import { Upload, FileText, Trash2, Pill, Calendar, Thermometer, Salad, StickyNote, Shield, MessageSquare, ArrowLeft, RefreshCw } from "lucide-react";
import TopBar from "@/components/TopBar";
import { api } from "@/lib/api";
import { usePersonContext } from "@/contexts/PersonContext";
import type { MedicalRecord } from "@/lib/storage";
import { formatDateIST } from "@/lib/time";
import { useTimezoneRefresh } from "@/lib/useTimezoneRefresh";

interface ChatMessage { role: "user" | "assistant"; content: string; }

type ExtractedItemType = "medication" | "appointment" | "symptom" | "dietary" | "other";

interface ExtractedItem {
  id: string;
  type: ExtractedItemType;
  label: string;
  data: Record<string, unknown>;
  selected: boolean;
}

const TYPE_ICON: Record<ExtractedItemType, React.FC<{ className?: string }>> = {
  medication: Pill,
  appointment: Calendar,
  symptom: Thermometer,
  dietary: Salad,
  other: StickyNote,
};

const TYPE_LABEL: Record<ExtractedItemType, string> = {
  medication: "Medication",
  appointment: "Appointment",
  symptom: "Symptom",
  dietary: "Dietary note",
  other: "Other note",
};

export default function RecordsPage() {
  useTimezoneRefresh();
  const { activePersonId } = usePersonContext();
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRecord, setActiveRecord] = useState<MedicalRecord | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
  const [addingItems, setAddingItems] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const fileRef = useRef<HTMLInputElement>(null);
  const reExtractFileRef = useRef<HTMLInputElement>(null);
  const [reExtractRecordId, setReExtractRecordId] = useState<string | null>(null);
  const [reExtractConfirmRecord, setReExtractConfirmRecord] = useState<MedicalRecord | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activePersonId) return;
    setLoading(true);
    api.records.getAll().then((data) => { setRecords(data); setLoading(false); });
  }, [activePersonId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function processFile(file: File) {
    if (!file.name.endsWith(".pdf") && !file.name.endsWith(".txt")) {
      toast.error("Only PDF and TXT files are supported"); return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("File too large — maximum upload size is 4 MB"); return;
    }
    setUploading(true);
    try {
      let text = "";
      if (file.name.endsWith(".txt")) {
        text = await file.text();
      } else {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/parse-pdf", { method: "POST", body: formData });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "PDF parse failed");
        text = json.text;
      }

      toast.loading("Generating summary...", { id: "summary" });
      const sumRes = await fetch("/api/summarize", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const sumData = await sumRes.json();
      toast.dismiss("summary");
      if (sumData.error) throw new Error(sumData.error);

      const record: MedicalRecord = {
        id: uuidv4(), name: file.name, text,
        summary: sumData.summary || "",
        dietary: sumData.dietary || "",
        other: sumData.other || "",
        uploadedAt: new Date().toISOString(),
      };
      await api.records.save(record);
      await api.activity.push({ type: "record", label: `Uploaded report: ${file.name}`, at: record.uploadedAt });


      setRecords(await api.records.getAll());
      openRecord(record);
      toast.success("Report uploaded and summarised!");

      const extracted = await fetch("/api/extract-report-data", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      }).then((r) => r.json());

      // Auto-insert vitals from report (no confirmation needed — objective numbers)
      const extractedVitals: Array<{ type: string; value: number; value2?: number; unit: string; notes?: string }> = extracted.vitals || [];
      let vitalCount = 0;
      for (const v of extractedVitals) {
        if (v.type && typeof v.value === "number" && !isNaN(v.value)) {
          await api.vitals.save({ id: uuidv4(), type: v.type as import("@/lib/storage").VitalType, value: v.value, value2: v.value2, unit: v.unit || "", notes: v.notes || "From report", loggedAt: new Date().toISOString() });
          vitalCount++;
        }
      }
      // Auto-update health profile from report
      const extractedProfile = extracted.profile || {};
      const currentProfile = await api.healthProfile.get();
      const mergedProfile = { ...currentProfile };
      if (extractedProfile.age) mergedProfile.age = extractedProfile.age;
      if (extractedProfile.heightCm) mergedProfile.heightCm = extractedProfile.heightCm;
      if (extractedProfile.gender) mergedProfile.gender = extractedProfile.gender;
      if (extractedProfile.bloodType) mergedProfile.bloodType = extractedProfile.bloodType;
      if (JSON.stringify(mergedProfile) !== JSON.stringify(currentProfile)) await api.healthProfile.set(mergedProfile);
      if (vitalCount > 0) toast.success(`${vitalCount} vital reading${vitalCount !== 1 ? "s" : ""} auto-filled from report`);

      const items: ExtractedItem[] = [
        ...(extracted.medications || []).map((m: Record<string, unknown>) => ({
          id: uuidv4(), type: "medication" as const, selected: true,
          label: `${m.name}${m.dosage ? ` — ${m.dosage}` : ""}${m.frequency ? ` (${m.frequency})` : ""}${m.durationDays ? ` · ${m.durationDays}d course` : ""}`,
          data: m,
        })),
        ...(extracted.appointments || []).map((a: Record<string, unknown>) => {
          const days = (a.daysFromNow as number) || 30;
          const date = new Date(Date.now() + days * 86400000).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
          return {
            id: uuidv4(), type: "appointment" as const, selected: true,
            label: `${a.doctor || "Doctor"}${a.specialty ? ` (${a.specialty})` : ""} — ${a.notes} — ${date}`,
            data: a,
          };
        }),
        ...(extracted.symptoms || []).map((s: Record<string, unknown>) => ({
          id: uuidv4(), type: "symptom" as const, selected: true,
          label: `${s.symptom} — severity ${s.severity}/5${s.notes ? ` (${s.notes})` : ""}`,
          data: s,
        })),
        ...(extracted.dietary || []).map((d: Record<string, unknown>) => ({
          id: uuidv4(), type: "dietary" as const, selected: true,
          label: (d.advice as string) || "",
          data: d,
        })),
        ...(extracted.other || []).map((o: Record<string, unknown>) => ({
          id: uuidv4(), type: "other" as const, selected: true,
          label: (o.note as string) || "",
          data: o,
        })),
      ].filter((i) => i.label.trim());

      if (items.length > 0) setExtractedItems(items);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to process file: ${msg}`);
    } finally {
      setUploading(false);
    }
  }

  function triggerReExtract(record: MedicalRecord) {
    setReExtractConfirmRecord(record);
  }

  function confirmReExtract() {
    if (!reExtractConfirmRecord) return;
    setReExtractRecordId(reExtractConfirmRecord.id);
    setReExtractConfirmRecord(null);
    reExtractFileRef.current?.click();
  }

  async function reExtractFromFile(file: File) {
    const record = records.find((r) => r.id === reExtractRecordId);
    if (!record) return;
    if (file.name !== record.name) {
      toast(`Re-extracting from "${file.name}" — this differs from the original "${record.name}". Proceeding anyway.`, { icon: "⚠️" });
    }
    if (!file.name.endsWith(".pdf") && !file.name.endsWith(".txt")) {
      toast.error("Only PDF and TXT files are supported");
      setReExtractRecordId(null);
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("File too large — maximum upload size is 4 MB");
      setReExtractRecordId(null);
      return;
    }
    setUploading(true);
    try {
      let text = "";
      if (file.name.endsWith(".txt")) {
        text = await file.text();
      } else {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/parse-pdf", { method: "POST", body: formData });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "PDF parse failed");
        text = json.text;
      }

      // Update active record with the text for chat context
      setActiveRecord({ ...record, text });

      toast.loading("Re-extracting data...", { id: "reextract" });
      const extracted = await fetch("/api/extract-report-data", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      }).then((r) => r.json());
      toast.dismiss("reextract");

      const items: ExtractedItem[] = [
        ...(extracted.medications || []).map((m: Record<string, unknown>) => ({
          id: uuidv4(), type: "medication" as const, selected: true,
          label: `${m.name}${m.dosage ? ` — ${m.dosage}` : ""}${m.frequency ? ` (${m.frequency})` : ""}${m.durationDays ? ` · ${m.durationDays}d course` : ""}`,
          data: m,
        })),
        ...(extracted.appointments || []).map((a: Record<string, unknown>) => {
          const days = (a.daysFromNow as number) || 30;
          const date = new Date(Date.now() + days * 86400000).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
          return {
            id: uuidv4(), type: "appointment" as const, selected: true,
            label: `${a.doctor || "Doctor"}${a.specialty ? ` (${a.specialty})` : ""} — ${a.notes} — ${date}`,
            data: a,
          };
        }),
        ...(extracted.symptoms || []).map((s: Record<string, unknown>) => ({
          id: uuidv4(), type: "symptom" as const, selected: true,
          label: `${s.symptom} — severity ${s.severity}/5${s.notes ? ` (${s.notes})` : ""}`,
          data: s,
        })),
        ...(extracted.dietary || []).map((d: Record<string, unknown>) => ({
          id: uuidv4(), type: "dietary" as const, selected: true,
          label: (d.advice as string) || "",
          data: d,
        })),
        ...(extracted.other || []).map((o: Record<string, unknown>) => ({
          id: uuidv4(), type: "other" as const, selected: true,
          label: (o.note as string) || "",
          data: o,
        })),
      ].filter((i) => i.label.trim());

      if (items.length > 0) {
        setExtractedItems(items);
        toast.success("Re-extraction complete — review items below");
      } else {
        toast("No items found in this report");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Re-extraction failed: ${msg}`);
    } finally {
      setUploading(false);
      setReExtractRecordId(null);
    }
  }

  function openRecord(record: MedicalRecord) {
    setActiveRecord(record);
    let content = `**Summary**\n\n${record.summary}`;
    if (record.dietary?.trim()) content += `\n\n---\n\n**Dietary Notes**\n\n${record.dietary}`;
    if (record.other?.trim()) content += `\n\n---\n\n**Other Notes**\n\n${record.other}`;
    const hasFullText = !!record.text;
    content += `\n\n---\n_${hasFullText ? "Ask me anything about this report." : "Upload the report again to ask questions."}_`;
    setMessages([{ role: "assistant", content }]);
    setMobileView("chat");
  }

  async function sendMessage() {
    if (!input.trim() || streaming) return;
    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          context: activeRecord?.text || activeRecord?.summary || "",
        }),
      });
      if (!res.body) throw new Error();
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let aiContent = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        aiContent += decoder.decode(value, { stream: true });
        setMessages((prev) => { const u = [...prev]; u[u.length - 1] = { role: "assistant", content: aiContent }; return u; });
      }
    } catch { toast.error("Response failed. Try again."); }
    finally { setStreaming(false); }
  }

  async function addSelectedItems() {
    const selected = extractedItems.filter((i) => i.selected);
    if (selected.length === 0) { setExtractedItems([]); return; }
    setAddingItems(true);
    try {
      for (const item of selected) {
        if (item.type === "medication") {
          const m = item.data;
          const durationDays = (m.durationDays as number) || 0;
          await api.medications.save({ id: uuidv4(), name: m.name as string, dosage: (m.dosage as string) || "", frequency: (m.frequency as string) || "As needed", times: (m.times as string[]) || [], notes: (m.notes as string) || "", log: {}, expiresAt: durationDays > 0 ? new Date(Date.now() + durationDays * 86400000).toISOString() : undefined });
        } else if (item.type === "symptom") {
          const s = item.data;
          await api.symptoms.save({ id: uuidv4(), symptom: s.symptom as string, severity: (s.severity as number) || 3, notes: (s.notes as string) || "", loggedAt: new Date().toISOString() });
        } else if (item.type === "appointment") {
          const a = item.data;
          const days = (a.daysFromNow as number) || 30;
          await api.appointments.save({ id: uuidv4(), doctor: (a.doctor as string) || "", specialty: (a.specialty as string) || "", datetime: new Date(Date.now() + days * 86400000).toISOString(), location: "", notes: (a.notes as string) || "", status: "upcoming", postVisitNotes: "" });
        } else if (item.type === "dietary") {
          await api.dietary.save({ id: uuidv4(), content: item.label, source: activeRecord?.name || "Report", createdAt: new Date().toISOString() });
        } else if (item.type === "other") {
          await api.other.save({ id: uuidv4(), content: item.label, source: activeRecord?.name || "Report", createdAt: new Date().toISOString() });
        }
      }
      await api.activity.push({ type: "record", label: `Added ${selected.length} items from report`, at: new Date().toISOString() });
      toast.success(`Added ${selected.length} item${selected.length > 1 ? "s" : ""} from report`);
      setExtractedItems([]);
    } catch {
      toast.error("Failed to add some items");
    } finally {
      setAddingItems(false);
    }
  }

  function deleteRecord(id: string) {
    const record = records.find((r) => r.id === id);
    if (!record) return;
    const prevRecords = [...records];
    setRecords((prev) => prev.filter((r) => r.id !== id));
    const wasActive = activeRecord?.id === id;
    if (wasActive) { setActiveRecord(null); setMessages([]); setMobileView("list"); }
    let undone = false;
    const tid = `undo-rec-${id}`;
    toast.custom(
      (t) => (
        <div className={`flex items-center gap-3 bg-gray-900 text-white pl-4 pr-3 py-3 rounded-xl shadow-lg max-w-xs transition-all ${t.visible ? "opacity-100" : "opacity-0"}`}>
          <span className="text-sm flex-1">Report deleted</span>
          <button
            onClick={() => {
              undone = true;
              toast.dismiss(tid);
              setRecords(prevRecords);
              if (wasActive) setActiveRecord(record);
            }}
            className="font-semibold text-teal-300 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 transition-colors text-sm"
          >
            Undo
          </button>
        </div>
      ),
      { id: tid, duration: 5000 }
    );
    setTimeout(async () => {
      if (!undone) {
        await api.records.delete(id);
        api.activity.push({ type: "record", label: `Deleted report: ${record.name}`, at: new Date().toISOString(), deleted: true });
      }
    }, 5100);
  }

  async function clearAllRecords() {
    if (!confirm("Delete all reports for this person? This cannot be undone.")) return;
    const count = records.length;
    await api.records.clearAll();
    api.activity.push({ type: "record", label: `Cleared all reports (${count} item${count !== 1 ? "s" : ""})`, at: new Date().toISOString(), deleted: true });
    setRecords([]);
    setActiveRecord(null);
    setMessages([]);
    setMobileView("list");
    toast.success("All reports deleted");
  }

  return (
    <>
      <TopBar reportName={activeRecord?.name} />

      <div className="flex overflow-hidden" style={{ height: "calc(100vh - 3.5rem)" }}>
        {/* Reports list panel */}
        <div className={`${mobileView === "list" ? "flex" : "hidden"} md:flex flex-col w-full md:w-[25%] flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-y-auto`}>
          {/* Upload zone */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
                dragOver ? "border-teal-400 bg-teal-50 dark:bg-teal-900/20" : "border-gray-300 dark:border-gray-600 hover:border-teal-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept=".pdf,.txt" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ""; }} />
              <input ref={reExtractFileRef} type="file" accept=".pdf,.txt" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) reExtractFromFile(f); e.target.value = ""; }} />
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-teal-600 dark:text-teal-400 font-medium">Processing...</p>
                </div>
              ) : (
                <>
                  <Upload className="w-7 h-7 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Drop a report here or tap to upload</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">PDF or TXT files · Max 4 MB</p>
                  <p className="flex items-center justify-center gap-1 text-xs text-gray-400 dark:text-gray-500 mt-2">
                    <Shield className="w-3 h-3" /> Report text is never stored
                  </p>
                </>
              )}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Reports ({records.length})
              </h3>
              {records.length > 0 && (
                <button onClick={clearAllRecords} className="text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors">
                  Clear all
                </button>
              )}
            </div>
            {loading ? (
              <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>
            ) : records.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">No reports yet</p>
            ) : (
              <ul className="space-y-2">
                {records.map((r) => (
                  <li key={r.id}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      activeRecord?.id === r.id ? "border-teal-400 bg-teal-50 dark:bg-teal-900/20" : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800"
                    }`}
                    onClick={() => openRecord(r)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <FileText className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{r.name}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{formatDateIST(r.uploadedAt)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); triggerReExtract(r); }}
                          title="Re-extract data from this report"
                          className="p-2.5 -m-1 text-gray-300 dark:text-gray-600 hover:text-teal-500 dark:hover:text-teal-400 transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteRecord(r.id); }}
                          title="Delete this report"
                          className="p-2.5 -m-1 text-gray-300 dark:text-gray-600 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Chat panel */}
        <div className={`${mobileView === "chat" ? "flex" : "hidden"} md:flex flex-col flex-1 bg-gray-50 dark:bg-gray-900 min-w-0`}>
          {/* Mobile back button */}
          <div className="md:hidden flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
            <button onClick={() => setMobileView("list")} className="flex items-center gap-1.5 text-sm text-teal-600 dark:text-teal-400">
              <ArrowLeft className="w-4 h-4" /> All reports
            </button>
            {activeRecord && <span className="text-xs text-gray-400 dark:text-gray-500 truncate ml-auto max-w-[50%]">{activeRecord.name}</span>}
          </div>

          {!activeRecord ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center mb-4">
                <MessageSquare className="w-7 h-7 text-teal-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Upload a report to get started</h3>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-2 leading-relaxed">
                Upload a PDF or TXT medical report and get a plain-English summary of medications, appointments, and key findings — then ask follow-up questions in plain language.
              </p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-teal-600 text-white rounded-br-sm"
                        : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-sm shadow-sm"
                    }`}>
                      {msg.content ? (
                        msg.role === "user" ? (
                          <span className="whitespace-pre-wrap">{msg.content}</span>
                        ) : (
                          <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0 prose-strong:font-semibold prose-hr:my-2 dark:prose-invert">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        )
                      ) : (
                        <span className="inline-flex gap-1">
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="p-3 sm:p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
                <div className="flex gap-2">
                  <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                    placeholder="Ask anything about this report..." className="input flex-1" disabled={streaming} />
                  <button onClick={sendMessage} disabled={!input.trim() || streaming} className="btn-primary px-4 disabled:opacity-50">
                    {streaming ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> : "Send"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Re-extract confirmation modal */}
      {reExtractConfirmRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4" onClick={() => setReExtractConfirmRecord(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full sm:max-w-sm p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-teal-500 flex-shrink-0" />
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Re-extract data</h3>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Select the original PDF for <span className="font-medium text-gray-700 dark:text-gray-300">{reExtractConfirmRecord.name}</span> to re-run AI extraction. Previously saved items won&apos;t be removed automatically.
            </p>
            <div className="flex gap-2 pt-1">
              <button onClick={confirmReExtract} className="btn-primary flex-1">Choose file</button>
              <button onClick={() => setReExtractConfirmRecord(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Extracted items modal */}
      {extractedItems.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[80vh] flex flex-col">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Found in this report</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Only items explicitly mentioned. Uncheck anything you don&apos;t want to add.</p>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-2">
              {extractedItems.map((item) => {
                const Icon = TYPE_ICON[item.type];
                return (
                  <label key={item.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      item.selected ? "bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-700" : "bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600"
                    }`}>
                    <input type="checkbox" checked={item.selected}
                      onChange={() => setExtractedItems((prev) => prev.map((i) => i.id === item.id ? { ...i, selected: !i.selected } : i))}
                      className="mt-0.5 accent-teal-600 flex-shrink-0" />
                    <Icon className="w-4 h-4 mt-0.5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-400 dark:text-gray-500">{TYPE_LABEL[item.type]}</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{item.label}</p>
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="p-5 border-t border-gray-100 dark:border-gray-700 flex gap-3">
              <button onClick={addSelectedItems} disabled={addingItems || extractedItems.every((i) => !i.selected)} className="btn-primary flex-1 disabled:opacity-50">
                {addingItems ? "Adding..." : `Add ${extractedItems.filter((i) => i.selected).length} item${extractedItems.filter((i) => i.selected).length !== 1 ? "s" : ""}`}
              </button>
              <button onClick={() => setExtractedItems([])} className="btn-secondary px-5">Dismiss</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
