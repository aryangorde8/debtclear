"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mic, MicOff, PhoneOff, Loader2, Volume2, CheckCircle2, XCircle, Send } from "lucide-react";
import { Debt, LeverageAnalysis, RoleplayTurn } from "@/types";
import { roleplay } from "@/lib/api";
import { toast } from "sonner";

interface Props {
  debt: Debt;
  leverage: LeverageAnalysis;
  onClose: () => void;
}

type CallStatus = "idle" | "ringing" | "active" | "settled" | "declined" | "ended";

// Browser SpeechRecognition compatibility shim
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function PhoneRoleplayModal({ debt, leverage, onClose }: Props) {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [history, setHistory] = useState<RoleplayTurn[]>([]);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [settlementAmount, setSettlementAmount] = useState<number | null>(null);
  const [supportError, setSupportError] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  const [micUnavailable, setMicUnavailable] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTranscriptRef = useRef<string>("");
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const cancelledRef = useRef(false);

  // Check browser support on mount
  useEffect(() => {
    const SR = getSpeechRecognition();
    if (!SR) {
      setSupportError(
        "Voice recognition isn't supported in this browser. Try Chrome, Edge, or Safari on desktop."
      );
      return;
    }
    if (typeof window !== "undefined" && !window.speechSynthesis) {
      setSupportError("Voice synthesis isn't supported in this browser.");
    }
  }, []);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, interimTranscript, isThinking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      try {
        recognitionRef.current?.abort();
      } catch {}
      if (typeof window !== "undefined") {
        window.speechSynthesis?.cancel();
      }
    };
  }, []);

  const speak = useCallback((text: string): void => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((v) => /en-US/i.test(v.lang) && /female|samantha|zira|jenny/i.test(v.name)) ||
      voices.find((v) => /en-US/i.test(v.lang)) ||
      voices.find((v) => /^en/i.test(v.lang));
    if (preferred) utterance.voice = preferred;
    // Estimate duration — 150 words/min average speech
    const wordCount = text.split(/\s+/).length;
    const durationMs = Math.max(2000, (wordCount / 150) * 60 * 1000);
    setIsSpeaking(true);
    const done = () => setIsSpeaking(false);
    utterance.onend = done;
    utterance.onerror = done;
    // Safety fallback: clear speaking state after estimated duration + 1s buffer
    setTimeout(done, durationMs + 1000);
    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      done();
    }
  }, []);

  const fetchCreditorTurn = useCallback(
    async (turn: RoleplayTurn[]): Promise<{ message: string; status: CallStatus; amount: number | null } | null> => {
      try {
        const r = await roleplay(debt, leverage, turn);
        let s: CallStatus = "active";
        if (r.status === "settled") s = "settled";
        else if (r.status === "declined") s = "declined";
        return { message: r.message, status: s, amount: r.settlement_amount };
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Connection lost");
        return null;
      }
    },
    [debt, leverage]
  );

  const startCall = useCallback(async () => {
    if (supportError) return;
    cancelledRef.current = false;
    setStatus("ringing");
    setHistory([]);
    setSettlementAmount(null);

    setIsThinking(true);
    const opener = await fetchCreditorTurn([]);
    setIsThinking(false);

    if (!opener || cancelledRef.current) {
      setStatus("idle");
      return;
    }

    setStatus("active");
    const openingTurn: RoleplayTurn = { role: "creditor", text: opener.message };
    setHistory([openingTurn]);
    speak(opener.message);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [supportError, fetchCreditorTurn, speak]);

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {}
    setIsListening(false);
  }, []);

  const submitUserTurn = useCallback(
    async (userText: string) => {
      const trimmed = userText.trim();
      if (!trimmed) return;

      const newHistory: RoleplayTurn[] = [...history, { role: "user", text: trimmed }];
      setHistory(newHistory);
      setInterimTranscript("");

      setIsThinking(true);
      const reply = await fetchCreditorTurn(newHistory);
      setIsThinking(false);
      if (!reply || cancelledRef.current) return;

      setHistory((h) => [...h, { role: "creditor", text: reply.message }]);
      speak(reply.message); // fire-and-forget

      if (reply.status === "settled") {
        setStatus("settled");
        setSettlementAmount(reply.amount);
        toast.success(`Settled for $${(reply.amount || 0).toLocaleString()}!`);
      } else if (reply.status === "declined") {
        setStatus("declined");
      }
    },
    [history, fetchCreditorTurn, speak]
  );

  const startListening = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR) return;
    if (isSpeaking || isThinking) return;

    finalTranscriptRef.current = "";
    setInterimTranscript("");

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      if (final) {
        finalTranscriptRef.current += final;
      }
      setInterimTranscript(finalTranscriptRef.current + interim);
    };

    recognition.onend = () => {
      setIsListening(false);
      const text = finalTranscriptRef.current.trim();
      if (text) {
        submitUserTurn(text);
      } else {
        setInterimTranscript("");
      }
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      if (event.error === "network" || event.error === "service-not-allowed") {
        setMicUnavailable(true);
      } else if (event.error !== "aborted" && event.error !== "no-speech") {
        toast.error(`Microphone error: ${event.error}`);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      // Already started
    }
  }, [isSpeaking, isThinking, submitUserTurn]);

  const endCall = useCallback(() => {
    cancelledRef.current = true;
    try {
      recognitionRef.current?.abort();
    } catch {}
    if (typeof window !== "undefined") {
      window.speechSynthesis?.cancel();
    }
    setIsListening(false);
    setIsSpeaking(false);
    setIsThinking(false);
    if (status === "active" || status === "ringing") {
      setStatus("ended");
    }
  }, [status]);

  const callIsLive = status === "active" && !settlementAmount;
  const canSpeak = callIsLive && !isSpeaking && !isThinking && !isListening;
  const canSend = callIsLive && !isThinking && textInput.trim().length > 0;

  const sendText = useCallback(() => {
    const text = textInput.trim();
    if (!text || !callIsLive) return;
    setTextInput("");
    submitUserTurn(text);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [textInput, callIsLive, submitUserTurn]);

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          key="modal"
          className="relative w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] bg-gradient-to-b from-zinc-950 to-zinc-900 border border-white/10 rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col"
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-400 to-blue-500 flex items-center justify-center text-white font-bold text-base shrink-0">
                S
              </div>
              <div>
                <h2 className="font-bold text-base text-white">Sarah Mitchell</h2>
                <p className="text-xs text-zinc-400">Collections · {debt.name}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-white transition-colors p-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Status bar */}
          <div className="px-5 py-2 bg-black/40 border-b border-white/5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {status === "idle" && <span className="text-zinc-500">Ready to call</span>}
              {status === "ringing" && (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-amber-400">Connecting…</span>
                </>
              )}
              {status === "active" && (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-400">Live call</span>
                </>
              )}
              {status === "settled" && (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Settled · ${settlementAmount?.toLocaleString()}</span>
                </>
              )}
              {status === "declined" && (
                <>
                  <XCircle className="h-3.5 w-3.5 text-red-400" />
                  <span className="text-red-400">No deal</span>
                </>
              )}
              {status === "ended" && <span className="text-zinc-500">Call ended</span>}
            </div>
            <div className="flex items-center gap-2 text-zinc-500">
              {isSpeaking && (
                <>
                  <Volume2 className="h-3.5 w-3.5 animate-pulse text-blue-400" />
                  <span className="text-blue-400">Sarah speaking</span>
                </>
              )}
              {isThinking && !isSpeaking && (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
                  <span>Thinking…</span>
                </>
              )}
              {isListening && (
                <>
                  <Mic className="h-3.5 w-3.5 animate-pulse text-emerald-400" />
                  <span className="text-emerald-400">Listening</span>
                </>
              )}
            </div>
          </div>

          {/* Conversation */}
          <div className="overflow-y-auto flex-1 p-5 space-y-3">
            {supportError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-300">
                {supportError}
              </div>
            )}

            {status === "ringing" && (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <div className="w-16 h-16 rounded-full bg-amber-400/10 border border-amber-400/30 flex items-center justify-center">
                  <Loader2 className="h-7 w-7 animate-spin text-amber-400" />
                </div>
                <p className="text-sm text-zinc-400">Connecting to Sarah…</p>
              </div>
            )}

            {status === "idle" && !supportError && (
              <div className="flex flex-col items-center justify-center py-8 text-center gap-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-white/10 flex items-center justify-center">
                  <Mic className="h-9 w-9 text-emerald-400" />
                </div>
                <div className="max-w-md">
                  <h3 className="text-xl font-bold text-white mb-2">Practice your call</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    You&apos;ll roleplay the negotiation with Sarah, an AI collections agent.
                    Speak naturally — she&apos;ll push back, counter, and only settle if you make
                    a strong case. Use your script as a guide.
                  </p>
                </div>
                <button
                  onClick={startCall}
                  className="mt-2 px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-black rounded-full font-semibold text-sm flex items-center gap-2 transition-all hover:scale-105"
                >
                  <Mic className="h-4 w-4" /> Start the call
                </button>
              </div>
            )}

            {history.map((turn, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${turn.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    turn.role === "user"
                      ? "bg-blue-500/20 border border-blue-400/30 text-blue-50 rounded-br-sm"
                      : "bg-white/5 border border-white/10 text-zinc-100 rounded-bl-sm"
                  }`}
                >
                  {turn.role === "creditor" && (
                    <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">
                      Sarah
                    </div>
                  )}
                  {turn.text}
                </div>
              </motion.div>
            ))}

            {isListening && interimTranscript && (
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm px-4 py-2.5 text-sm bg-blue-500/10 border border-blue-400/20 text-blue-200/70 italic">
                  {interimTranscript}
                </div>
              </div>
            )}

            {isThinking && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            {status === "settled" && settlementAmount !== null && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gradient-to-r from-emerald-500/15 to-blue-500/15 border border-emerald-400/30 rounded-xl p-4 mt-4"
              >
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold mb-1">
                  <CheckCircle2 className="h-4 w-4" /> Deal closed
                </div>
                <div className="text-2xl font-bold text-white">
                  ${settlementAmount.toLocaleString()}
                </div>
                <div className="text-xs text-zinc-400 mt-1">
                  You saved ${(debt.balance - settlementAmount).toLocaleString()} on a $
                  {debt.balance.toLocaleString()} balance
                </div>
              </motion.div>
            )}

            <div ref={transcriptEndRef} />
          </div>

          {/* Controls */}
          {(status === "active" || status === "ringing" || status === "settled" || status === "declined") && (
            <div className="border-t border-white/10 bg-black/40">
              {callIsLive && (
                <>
                  {/* Text input row */}
                  <div className="flex items-center gap-2 px-4 pt-3 pb-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); } }}
                      placeholder={isThinking ? "Sarah is thinking…" : "Type your response…"}
                      disabled={isThinking}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-emerald-500/50 transition-colors disabled:opacity-50"
                      autoComplete="off"
                    />
                    <button
                      onClick={sendText}
                      disabled={!canSend}
                      className="w-10 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all hover:scale-105 shrink-0"
                    >
                      <Send className="h-4 w-4 text-black" />
                    </button>
                  </div>
                  {/* Mic + hang-up row */}
                  <div className="flex items-center justify-between px-4 pb-3">
                    <div className="flex items-center gap-2">
                      {!micUnavailable ? (
                        <button
                          onClick={isListening ? stopListening : startListening}
                          disabled={!canSpeak && !isListening}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            isListening
                              ? "bg-red-500/20 text-red-300 border border-red-500/30"
                              : canSpeak
                              ? "bg-white/5 text-zinc-300 border border-white/10 hover:border-emerald-500/40"
                              : "bg-white/5 text-zinc-500 border border-white/5 cursor-not-allowed opacity-50"
                          }`}
                        >
                          {isListening ? (
                            <><span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" /><MicOff className="h-3.5 w-3.5" /> Stop</>
                          ) : (
                            <><Mic className="h-3.5 w-3.5" /> Voice</>
                          )}
                        </button>
                      ) : (
                        <span className="text-xs text-zinc-500">Voice unavailable — type instead</span>
                      )}
                    </div>
                    <button
                      onClick={endCall}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/20 text-red-300 border border-red-600/30 hover:bg-red-600/30 text-xs font-medium transition-colors"
                    >
                      <PhoneOff className="h-3.5 w-3.5" /> End call
                    </button>
                  </div>
                </>
              )}
              {!callIsLive && (
                <div className="flex justify-center p-4">
                  <button
                    onClick={onClose}
                    className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full text-sm font-medium transition-colors"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
