"use client";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";
import ReactMarkdown from "react-markdown";
import TopBar from "@/components/TopBar";
import { api } from "@/lib/api";
import type { MedicalRecord } from "@/lib/storage";
import { formatDateIST } from "@/lib/time";

interface ChatMessage { role: "user" | "assistant"; content: string; }

export default function RecordsPage() {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRecord, setActiveRecord] = useState<MedicalRecord | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.records.getAll().then(data => { setRecords(data); setLoading(false); });
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function processFile(file: File) {
    if (!file.name.endsWith(".pdf") && !file.name.endsWith(".txt")) {
      toast.error("Only PDF and TXT files are supported"); return;
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
        if (!res.ok) throw new Error("Parse failed");
        const data = await res.json();
        text = data.text;
      }
      toast.loading("Generating AI summary...", { id: "summary" });
      const sumRes = await fetch("/api/summarize", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const sumData = await sumRes.json();
      toast.dismiss("summary");
      if (sumData.error) throw new Error(sumData.error);

      const record: MedicalRecord = { id: uuidv4(), name: file.name, text, summary: sumData.summary || "", uploadedAt: new Date().toISOString() };
      await api.records.save(record);
      await api.activity.push({ type: "record", label: `Uploaded report: ${file.name}`, at: record.uploadedAt });
      setRecords(await api.records.getAll());
      loadRecord(record);
      toast.success("Report uploaded and summarized!");
    } catch {
      toast.error("Failed to process file. Try a .txt file.");
    } finally {
      setUploading(false);
    }
  }

  function loadRecord(record: MedicalRecord) {
    setActiveRecord(record);
    setMessages([{ role: "assistant", content: `**Summary of ${record.name}**\n\n${record.summary}\n\n---\n*Ask me anything about this report.*` }]);
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
        body: JSON.stringify({ messages: newMessages.map(m => ({ role: m.role, content: m.content })), context: activeRecord?.text || "" }),
      });
      if (!res.body) throw new Error();
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let aiContent = "";
      setMessages(prev => [...prev, { role: "assistant", content: "" }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        aiContent += decoder.decode(value, { stream: true });
        setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: "assistant", content: aiContent }; return u; });
      }
    } catch { toast.error("AI response failed. Try again."); }
    finally { setStreaming(false); }
  }

  async function deleteRecord(id: string) {
    await api.records.delete(id);
    setRecords(await api.records.getAll());
    if (activeRecord?.id === id) { setActiveRecord(null); setMessages([]); }
    toast.success("Report deleted");
  }

  return (
    <>
      <TopBar reportName={activeRecord?.name} />
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* Left panel */}
        <div className="w-full md:w-[40%] flex flex-col border-r border-gray-200 bg-white overflow-y-auto">
          <div className="p-4 border-b border-gray-200">
            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${dragOver ? "border-teal-400 bg-teal-50" : "border-gray-300 hover:border-teal-400 hover:bg-gray-50"}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept=".pdf,.txt" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ""; }} />
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-teal-600 font-medium">Processing...</p>
                </div>
              ) : (
                <>
                  <div className="text-3xl mb-2">📤</div>
                  <p className="text-sm font-medium text-gray-700">Drop a report here or click to upload</p>
                  <p className="text-xs text-gray-400 mt-1">PDF or TXT files</p>
                </>
              )}
            </div>
          </div>
          <div className="flex-1 p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Uploaded Reports ({records.length})
            </h3>
            {loading ? (
              <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>
            ) : records.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No reports yet</p>
            ) : (
              <ul className="space-y-2">
                {records.map(r => (
                  <li key={r.id}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${activeRecord?.id === r.id ? "border-teal-400 bg-teal-50" : "border-gray-200 hover:border-gray-300 bg-white"}`}
                    onClick={() => loadRecord(r)}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">📄 {r.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{formatDateIST(r.uploadedAt)}</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); deleteRecord(r.id); }}
                        className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 text-sm">🗑️</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right panel — chat */}
        <div className="hidden md:flex flex-col flex-1 bg-gray-50">
          {!activeRecord ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="text-5xl mb-4">💬</div>
              <h3 className="text-lg font-semibold text-gray-700">No report loaded</h3>
              <p className="text-gray-400 text-sm mt-2">Upload a report or select one from the left to start chatting</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user" ? "bg-teal-600 text-white rounded-br-sm" : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm"
                    }`}>
                      {msg.content ? (
                        msg.role === "user" ? (
                          <span className="whitespace-pre-wrap">{msg.content}</span>
                        ) : (
                          <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0 prose-strong:font-semibold prose-hr:my-2">
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
              <div className="p-4 bg-white border-t border-gray-200">
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
    </>
  );
}
