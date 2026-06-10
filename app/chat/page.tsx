"use client";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import toast from "react-hot-toast";
import { ShieldAlert, Send, Sparkles } from "lucide-react";
import TopBar from "@/components/TopBar";
import { api } from "@/lib/api";
import { usePersonContext } from "@/contexts/PersonContext";

interface Message { role: "user" | "assistant"; content: string; }

const FALLBACK_STARTERS = [
  "When should I take someone to the emergency room?",
  "How much water should an elderly person drink daily?",
  "What are general warning signs I should watch for?",
];

function buildStarters(data: {
  name: string;
  medications: { name: string }[];
  symptoms: { symptom: string; severity: number; loggedAt: string }[];
  vitals: { type: string; value: number; value2?: number; unit: string; loggedAt: string }[];
}): string[] {
  const prompts: string[] = [];
  const { name } = data;

  // Feature 14: Prioritise the most recently logged event as the first prompt
  const sortedSymptoms = [...data.symptoms].sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());
  const sortedVitals = [...data.vitals].sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());
  const mostRecentSym = sortedSymptoms[0];
  const mostRecentVital = sortedVitals[0];

  const symTime = mostRecentSym ? new Date(mostRecentSym.loggedAt).getTime() : 0;
  const vitTime = mostRecentVital ? new Date(mostRecentVital.loggedAt).getTime() : 0;
  const threeDays = Date.now() - 3 * 86_400_000;

  if (symTime > vitTime && symTime >= threeDays) {
    prompts.push(`Tell me about ${name}'s recent ${mostRecentSym.symptom} — what might be causing it?`);
  } else if (vitTime >= threeDays && mostRecentVital) {
    const VITAL_LABELS: Record<string, string> = { bp: "blood pressure", glucose: "blood glucose", weight: "weight", heart_rate: "heart rate", spo2: "SpO₂", temperature: "temperature", hba1c: "HbA1c", cholesterol: "cholesterol" };
    const vLabel = VITAL_LABELS[mostRecentVital.type] ?? mostRecentVital.type;
    const vVal = mostRecentVital.value2 != null ? `${mostRecentVital.value}/${mostRecentVital.value2}` : `${mostRecentVital.value}`;
    prompts.push(`${name}'s recent ${vLabel} reading was ${vVal} ${mostRecentVital.unit} — is that concerning?`);
  }

  // Medication-based
  if (data.medications.length > 0) {
    prompts.push(`What food or drug interactions should I know about for ${data.medications[0].name}?`);
  }
  if (data.medications.length > 1) {
    prompts.push(`Are there any interactions between ${data.medications[0].name} and ${data.medications[1].name}?`);
  }

  // Recent high-severity symptom (if not already added as top prompt)
  const weekAgo = Date.now() - 7 * 86_400_000;
  const recentHighSeverity = sortedSymptoms
    .filter((s) => new Date(s.loggedAt).getTime() >= weekAgo && s.severity >= 3 && s.symptom !== mostRecentSym?.symptom)[0];
  if (recentHighSeverity) {
    prompts.push(`${name} had ${recentHighSeverity.symptom} (severity ${recentHighSeverity.severity}/5) recently — what could cause this?`);
  }

  // Vital-based
  const latestByType = new Map<string, typeof data.vitals[0]>();
  sortedVitals.forEach((v) => { if (!latestByType.has(v.type)) latestByType.set(v.type, v); });

  const hba1c = latestByType.get("hba1c");
  if (hba1c) prompts.push(`${name}'s HbA1c was ${hba1c.value}% — what does that mean and how can diet help?`);

  const bp = latestByType.get("bp");
  if (bp && bp.value > 130) prompts.push(`Blood pressure was ${bp.value}/${bp.value2} mmHg — what lifestyle changes might help?`);

  const glucose = latestByType.get("glucose");
  if (glucose) prompts.push(`${name}'s blood glucose was ${glucose.value} mg/dL — is that within a normal range?`);

  // Pad with fallbacks if fewer than 3 data-driven prompts
  const combined = [...prompts, ...FALLBACK_STARTERS];
  return combined.slice(0, 5);
}

function buildContext(data: {
  nickname: string;
  medications: { name: string; dosage: string; frequency: string; notes: string }[];
  symptoms: { symptom: string; severity: number; notes: string; loggedAt: string }[];
  dietary: { content: string }[];
  other: { content: string }[];
  appointments: { doctor: string; specialty: string; status: string; postVisitNotes: string }[];
  vitals: { type: string; value: number; value2?: number; unit: string; loggedAt: string }[];
}): string {
  const lines: string[] = [`Patient: [anonymous]`];

  if (data.medications.length) {
    lines.push("\nCurrent medications:");
    data.medications.forEach((m) => {
      lines.push(`- ${m.name}${m.dosage ? ` (${m.dosage})` : ""}${m.frequency ? `, ${m.frequency}` : ""}${m.notes ? ` — ${m.notes}` : ""}`);
    });
  }

  if (data.symptoms.length) {
    lines.push("\nRecent symptoms (newest first):");
    data.symptoms.slice(0, 20).forEach((s) => {
      lines.push(`- ${s.symptom} (severity ${s.severity}/5)${s.notes ? `: ${s.notes}` : ""}`);
    });
  }

  if (data.dietary.length) {
    lines.push("\nDietary notes:");
    data.dietary.forEach((d) => lines.push(`- ${d.content}`));
  }

  if (data.other.length) {
    lines.push("\nOther instructions:");
    data.other.forEach((o) => lines.push(`- ${o.content}`));
  }

  if (data.appointments.length) {
    const recent = data.appointments.filter((a) => a.postVisitNotes || a.status === "completed").slice(0, 5);
    if (recent.length) {
      lines.push("\nRecent appointment notes:");
      recent.forEach((a) => {
        lines.push(`- ${a.doctor}${a.specialty ? ` (${a.specialty})` : ""}${a.postVisitNotes ? `: ${a.postVisitNotes}` : ""}`);
      });
    }
  }

  if (data.vitals.length) {
    const LABELS: Record<string, string> = { bp: "Blood Pressure", glucose: "Blood Glucose", weight: "Weight", heart_rate: "Heart Rate", spo2: "SpO₂", temperature: "Temperature" };
    // Latest reading per type
    const latest = new Map<string, (typeof data.vitals)[0]>();
    [...data.vitals].sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime())
      .forEach((v) => { if (!latest.has(v.type)) latest.set(v.type, v); });
    lines.push("\nRecent vitals (latest per type):");
    latest.forEach((v) => {
      const reading = v.value2 != null ? `${v.value}/${v.value2}` : `${v.value}`;
      const daysAgo = Math.floor((Date.now() - new Date(v.loggedAt).getTime()) / 86400000);
      const when = daysAgo === 0 ? "today" : `${daysAgo}d ago`;
      lines.push(`- ${LABELS[v.type] ?? v.type}: ${reading} ${v.unit} (${when})`);
    });
  }

  return lines.join("\n");
}

export default function ChatPage() {
  const { activePersonId, activePerson } = usePersonContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [context, setContext] = useState("");
  const [starters, setStarters] = useState<string[]>(FALLBACK_STARTERS);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!activePersonId) { setMessages([]); return; }
    try {
      const raw = localStorage.getItem(`cc_chat_messages__${activePersonId}`);
      setMessages(raw ? (JSON.parse(raw) as Message[]) : []);
    } catch { setMessages([]); }
  }, [activePersonId]);

  useEffect(() => {
    if (!activePersonId || messages.length === 0) return;
    try {
      localStorage.setItem(`cc_chat_messages__${activePersonId}`, JSON.stringify(messages.slice(-50)));
    } catch { /* ignore quota */ }
  }, [activePersonId, messages]);

  useEffect(() => {
    if (!activePersonId || !activePerson) return;
    Promise.all([
      api.medications.getAll(),
      api.symptoms.getAll(),
      api.dietary.getAll(),
      api.other.getAll(),
      api.appointments.getAll(),
      api.vitals.getAll(),
    ]).then(([meds, symptoms, dietary, other, appts, vitals]) => {
      setContext(buildContext({
        nickname: activePerson.nickname,
        medications: meds,
        symptoms,
        dietary,
        other,
        appointments: appts,
        vitals,
      }));
      setStarters(buildStarters({
        name: activePerson.nickname,
        medications: meds,
        symptoms,
        vitals,
      }));
    });
  }, [activePersonId, activePerson]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || streaming) return;
    const userMsg: Message = { role: "user", content: text.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch("/api/health-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          context,
        }),
      });
      if (!res.body) throw new Error();
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let ai = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        ai += decoder.decode(value, { stream: true });
        setMessages((prev) => { const u = [...prev]; u[u.length - 1] = { role: "assistant", content: ai }; return u; });
      }
    } catch {
      // Restore message so user can resend without retyping.
      setInput(userMsg.content);
      setMessages(messages);
      toast.error("Response failed — message restored. Try again.");
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <>
      <TopBar />
      <div className="flex flex-col bg-gray-50 dark:bg-gray-900" style={{ height: "calc(100vh - 3.5rem)" }}>

        {/* Disclaimer */}
        <div className="flex-shrink-0 mx-4 mt-3 mb-1">
          <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-3 py-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              This assistant gives general health information only. It is not a substitute for professional medical advice, diagnosis, or treatment. Messages and tracked health data are processed by an AI service (Groq) to generate responses.
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full gap-6 pb-8">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-teal-600 flex items-center justify-center mx-auto">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Health Assistant</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
                  Ask anything health-related. I have access to{" "}
                  {activePerson ? `${activePerson.nickname}'s` : "this person's"} medications, symptoms, dietary notes, and more.
                </p>
              </div>
              <div className="w-full max-w-sm space-y-2">
                {starters.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="w-full text-left px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 hover:border-teal-400 dark:hover:border-teal-600 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
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
                      <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0.5 prose-strong:font-semibold dark:prose-invert">
                        <ReactMarkdown components={{
                          table: ({ children }) => (
                            <div className="overflow-x-auto my-2">
                              <table className="w-full text-xs border-collapse">{children}</table>
                            </div>
                          ),
                          thead: ({ children }) => <thead className="bg-gray-100 dark:bg-gray-700">{children}</thead>,
                          th: ({ children }) => <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left font-semibold">{children}</th>,
                          td: ({ children }) => <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">{children}</td>,
                        }}>{msg.content}</ReactMarkdown>
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
            ))
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 p-3 sm:p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <div className="flex gap-2 max-w-3xl mx-auto">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send(input)}
              placeholder="Ask a health question..."
              className="input flex-1"
              disabled={streaming}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || streaming}
              className="btn-primary px-4 disabled:opacity-50 flex items-center gap-1.5"
            >
              {streaming
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
