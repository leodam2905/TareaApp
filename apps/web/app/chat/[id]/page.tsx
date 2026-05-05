"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { Send, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useT } from "@/contexts/LanguageContext";

type Message = {
  id: string;
  content: string;
  createdAt: string;
  sender: { id: string; name: string; avatarUrl: string | null; role: string };
};

type Me = { id: string; role: string };

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDay(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { t } = useT();

  const fetchMessages = useCallback(async () => {
    const res = await fetch(`/api/bookings/${id}/messages`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data);
    }
  }, [id]);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then(r => r.json()),
      fetchMessages(),
    ]).then(([meData]) => {
      setMe(meData);
      setLoading(false);
    });
  }, [fetchMessages]);

  // Poll every 5 seconds
  useEffect(() => {
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || sending) return;
    const content = input.trim();
    setInput("");
    setSending(true);
    const res = await fetch(`/api/bookings/${id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      const msg = await res.json();
      setMessages(prev => [...prev, msg]);
    }
    setSending(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // Group messages by day
  const grouped: { day: string; msgs: Message[] }[] = [];
  for (const msg of messages) {
    const day = formatDay(msg.createdAt);
    const last = grouped[grouped.length - 1];
    if (last && last.day === day) last.msgs.push(msg);
    else grouped.push({ day, msgs: [msg] });
  }

  const backHref = me?.role === "HANDYMAN" ? "/handyman/jobs" : "/customer/bookings";

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10 bg-tarea-ink/80 backdrop-blur flex-shrink-0">
        <Link href={backHref} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <p className="text-white font-bold">{t("page_chat")}</p>
          <p className="text-slate-500 text-xs">Messages about this booking</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-tarea-sky animate-spin" /></div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-400">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          grouped.map(({ day, msgs }) => (
            <div key={day}>
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-slate-500 text-xs">{day}</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
              <div className="space-y-3">
                {msgs.map(msg => {
                  const isMine = msg.sender.id === me?.id;
                  return (
                    <div key={msg.id} className={`flex items-end gap-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
                      {!isMine && (
                        <div className="w-7 h-7 rounded-full bg-tarea-sky/20 flex items-center justify-center text-tarea-sky text-xs font-bold flex-shrink-0 overflow-hidden mb-0.5">
                          {msg.sender.avatarUrl
                            ? <img src={msg.sender.avatarUrl} alt="" className="w-full h-full object-cover" />
                            : msg.sender.name[0]}
                        </div>
                      )}
                      <div className={`max-w-[70%] ${isMine ? "items-end" : "items-start"} flex flex-col gap-1`}>
                        {!isMine && (
                          <p className="text-slate-500 text-xs ml-1">{msg.sender.name}</p>
                        )}
                        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          isMine
                            ? "bg-tarea-sky text-tarea-ink rounded-br-sm"
                            : "bg-white/10 text-white rounded-bl-sm"
                        }`}>
                          {msg.content}
                        </div>
                        <p className={`text-slate-600 text-xs ${isMine ? "text-right mr-1" : "ml-1"}`}>
                          {formatTime(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-6 py-4 border-t border-white/10 bg-tarea-ink/80 backdrop-blur">
        <div className="flex gap-3 items-end">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Type a message… (Enter to send)"
            rows={1}
            className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-tarea-sky resize-none min-h-[44px] max-h-[120px]"
            style={{ height: "auto" }}
            onInput={e => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = Math.min(t.scrollHeight, 120) + "px";
            }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            className="w-11 h-11 flex-shrink-0 flex items-center justify-center bg-tarea-sky text-tarea-ink rounded-xl hover:bg-sky-300 transition-all disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
