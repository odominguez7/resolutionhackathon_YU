import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { Send, Bot, User, Sparkles, Activity, Brain } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  source?: string;
}

const SUGGESTIONS = [
  "Should I work out today?",
  "How is my sleep trending?",
  "Am I showing signs of burnout?",
  "What should I do to recover?",
  "Why is my HRV dropping?",
  "What interventions have worked best?",
];

export default function AskYU() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput("");
    const userMsg: Message = { role: "user", content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await api.post("/api/agent/chat", { message: msg });
      setMessages((prev) => [...prev, { role: "assistant", content: res.response, source: res.source }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Try again.", source: "error" }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(180deg,#060918 0%,#0b1120 40%,#0a0f1f 100%)" }}>

      {/* Header */}
      <div className="text-center pt-14 pb-4 px-5 flex-shrink-0">
        <div className="flex justify-center mb-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(59,130,246,0.15))", border: "1px solid rgba(139,92,246,0.2)" }}>
            <Brain className="w-6 h-6" style={{ color: "#a78bfa" }} />
          </div>
        </div>
        <h1 className="text-xl font-black tracking-tight" style={{ color: "#f1f5f9" }}>Ask YU</h1>
        <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>
          YU Cortex knows your biometrics, drift state, and intervention history
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        <div className="max-w-2xl mx-auto space-y-3">

          {/* Suggestions when empty */}
          {messages.length === 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pt-6">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3 text-center" style={{ color: "rgba(255,255,255,0.15)" }}>
                Try asking
              </p>
              <div className="grid grid-cols-2 gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)}
                    className="rounded-xl px-3 py-2.5 text-left text-[11px] font-medium border-0 cursor-pointer transition-all"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(139,92,246,0.2)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}>
                    {s}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Message bubbles */}
          <AnimatePresence>
            {messages.map((m, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-1"
                    style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.15)" }}>
                    <Bot className="w-3.5 h-3.5" style={{ color: "#a78bfa" }} />
                  </div>
                )}
                <div className="max-w-[80%] rounded-2xl px-4 py-3"
                  style={m.role === "user"
                    ? { background: "linear-gradient(135deg, #3b82f6, #7c3aed)", color: "#fff" }
                    : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.75)" }
                  }>
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{m.content}</p>
                  {m.source === "gemini" && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <Sparkles className="w-2.5 h-2.5" style={{ color: "rgba(255,255,255,0.2)" }} />
                      <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.15)" }}>Gemini 2.5</span>
                    </div>
                  )}
                </div>
                {m.role === "user" && (
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-1"
                    style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.15)" }}>
                    <User className="w-3.5 h-3.5" style={{ color: "#60a5fa" }} />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.15)" }}>
                <Bot className="w-3.5 h-3.5" style={{ color: "#a78bfa" }} />
              </div>
              <div className="rounded-2xl px-4 py-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center gap-1">
                  {[0, 1, 2].map((d) => (
                    <motion.div key={d} className="w-1.5 h-1.5 rounded-full"
                      style={{ background: "rgba(139,92,246,0.5)" }}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: d * 0.2 }} />
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-5 pb-6 pt-2">
        <div className="max-w-2xl mx-auto">
          <form onSubmit={(e) => { e.preventDefault(); send(); }}
            className="flex items-center gap-2 rounded-xl px-4 py-2"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <input ref={inputRef} type="text" value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your health, recovery, or what to do today..."
              disabled={loading}
              className="flex-1 bg-transparent border-0 outline-none text-[13px] placeholder:text-white/20"
              style={{ color: "rgba(255,255,255,0.8)" }} />
            <button type="submit" disabled={!input.trim() || loading}
              className="w-8 h-8 rounded-lg flex items-center justify-center border-0 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              style={{ background: input.trim() ? "linear-gradient(135deg,#3b82f6,#7c3aed)" : "rgba(255,255,255,0.05)" }}>
              <Send className="w-3.5 h-3.5" style={{ color: "#fff" }} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
