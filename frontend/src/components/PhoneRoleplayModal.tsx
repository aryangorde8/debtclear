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

  // Keep the input/mic available as long as the call hasn't been ended or
  // closed entirely. Even after a "settled" tag, Sarah may still be asking for
  // confirmation — the user must be able to reply or wrap up naturally.
  const callIsLive = status === "active" || status === "settled" || status === "declined";
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
        className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
        style={{ background: "hsl(var(--background) / 0.88)", backdropFilter: "blur(4px)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          key="modal"
          className="relative w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] paper-card overflow-hidden flex flex-col"
          style={{ borderRadius: 0 }}
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-foreground">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 border border-foreground flex items-center justify-center shrink-0">
                <span className="font-display font-medium text-base" style={{ fontStyle: "italic" }}>S</span>
              </div>
              <div>
                <h2 className="font-display font-medium text-base" style={{ fontStyle: "italic" }}>Sarah Mitchell</h2>
                <p className="font-mono text-xs text-muted-foreground">Collections · {debt.name}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Status bar */}
          <div className="px-5 py-2 bg-secondary/40 border-b border-foreground/20 flex items-center justify-between">
            <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.15em] uppercase">
              {status === "idle" && <span className="text-muted-foreground">Ready to call</span>}
              {status === "ringing" && (
                <>
                  <span className="w-1.5 h-1.5 bg-amber-600 animate-pulse" />
                  <span className="text-amber-700">Connecting…</span>
                </>
              )}
              {status === "active" && (
                <>
                  <span className="w-1.5 h-1.5 bg-green-700 animate-pulse" />
                  <span className="text-green-800">Live call</span>
                </>
              )}
              {status === "settled" && (
                <>
                  <CheckCircle2 className="h-3 w-3 text-green-800" />
                  <span className="text-green-800">Settled · ${settlementAmount?.toLocaleString()}</span>
                </>
              )}
              {status === "declined" && (
                <>
                  <XCircle className="h-3 w-3 text-red-700" />
                  <span className="text-red-700">No deal</span>
                </>
              )}
              {status === "ended" && <span className="text-muted-foreground">Call ended</span>}
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.15em] uppercase text-muted-foreground">
              {isSpeaking && (
                <>
                  <Volume2 className="h-3 w-3 animate-pulse" style={{ color: "hsl(var(--gold))" }} />
                  <span style={{ color: "hsl(var(--gold))" }}>Sarah speaking</span>
                </>
              )}
              {isThinking && !isSpeaking && (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Thinking…</span>
                </>
              )}
              {isListening && (
                <>
                  <Mic className="h-3 w-3 animate-pulse text-red-700" />
                  <span className="text-red-700">Listening</span>
                </>
              )}
            </div>
          </div>

          {/* Conversation */}
          <div className="overflow-y-auto flex-1 p-5 space-y-3">
            {supportError && (
              <div className="border border-red-700/40 bg-red-50/40 p-4 text-sm text-red-800 font-mono">
                {supportError}
              </div>
            )}

            {status === "ringing" && (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <div className="w-16 h-16 border border-foreground/30 flex items-center justify-center">
                  <Loader2 className="h-7 w-7 animate-spin" style={{ color: "hsl(var(--gold))" }} />
                </div>
                <p className="font-mono text-xs text-muted-foreground tracking-[0.12em] uppercase">Connecting to Sarah…</p>
              </div>
            )}

            {status === "idle" && !supportError && (
              <div className="flex flex-col items-center justify-center py-8 text-center gap-5">
                <div className="w-20 h-20 border border-foreground/30 flex items-center justify-center">
                  <Mic className="h-9 w-9 text-muted-foreground" />
                </div>
                <div className="max-w-md">
                  <h3 className="font-display text-xl font-medium mb-2" style={{ fontStyle: "italic" }}>Practice your call</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    You&apos;ll roleplay the negotiation with Sarah, an AI collections agent.
                    Speak naturally — she&apos;ll push back, counter, and only settle if you make
                    a strong case. Use your script as a guide.
                  </p>
                </div>
                <button onClick={startCall} className="btn-ink flex items-center gap-2 text-sm">
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
                  className={`max-w-[85%] px-4 py-2.5 text-sm leading-relaxed border ${
                    turn.role === "user"
                      ? "bg-foreground text-background border-foreground"
                      : "bg-secondary/30 border-border text-foreground"
                  }`}
                >
                  {turn.role === "creditor" && (
                    <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground mb-1">
                      Sarah
                    </div>
                  )}
                  {turn.text}
                </div>
              </motion.div>
            ))}

            {isListening && interimTranscript && (
              <div className="flex justify-end">
                <div className="max-w-[85%] px-4 py-2.5 text-sm border border-foreground/30 bg-secondary/20 text-muted-foreground italic">
                  {interimTranscript}
                </div>
              </div>
            )}

            {isThinking && (
              <div className="flex justify-start">
                <div className="border border-border bg-secondary/20 px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            {status === "settled" && settlementAmount !== null && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="border border-foreground p-5 bg-secondary/30 mt-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-green-800" />
                  <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-green-800">Deal closed</span>
                </div>
                <div className="font-mono font-bold text-3xl" style={{ color: "hsl(var(--gold))" }}>
                  ${settlementAmount.toLocaleString()}
                </div>
                <div className="font-mono text-xs text-muted-foreground mt-1">
                  You saved ${(debt.balance - settlementAmount).toLocaleString()} on a ${debt.balance.toLocaleString()} balance
                </div>
              </motion.div>
            )}

            <div ref={transcriptEndRef} />
          </div>

          {/* Controls */}
          {(status === "active" || status === "ringing" || status === "settled" || status === "declined") && (
            <div className="border-t border-foreground/20 bg-secondary/30">
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
                      className="flex-1 border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-foreground transition-colors disabled:opacity-50 font-mono"
                      autoComplete="off"
                    />
                    <button
                      onClick={sendText}
                      disabled={!canSend}
                      className="w-10 h-10 bg-foreground hover:bg-foreground/80 text-background disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all shrink-0"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                  {/* Mic + hang-up row */}
                  <div className="flex items-center justify-between px-4 pb-3">
                    <div className="flex items-center gap-2">
                      {!micUnavailable ? (
                        <button
                          onClick={isListening ? stopListening : startListening}
                          disabled={!canSpeak && !isListening}
                          className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] tracking-[0.12em] uppercase border transition-all ${
                            isListening
                              ? "border-red-700/40 text-red-700 bg-red-50/30"
                              : canSpeak
                              ? "border-foreground text-foreground hover:bg-foreground hover:text-background"
                              : "border-border text-muted-foreground cursor-not-allowed opacity-50"
                          }`}
                        >
                          {isListening ? (
                            <><span className="w-1.5 h-1.5 bg-red-700 animate-pulse" /><MicOff className="h-3.5 w-3.5" /> Stop</>
                          ) : (
                            <><Mic className="h-3.5 w-3.5" /> Voice</>
                          )}
                        </button>
                      ) : (
                        <span className="font-mono text-[10px] text-muted-foreground">Voice unavailable — type instead</span>
                      )}
                    </div>
                    <button
                      onClick={endCall}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-red-700/40 text-red-700 hover:bg-red-50/30 font-mono text-[10px] tracking-[0.12em] uppercase transition-colors"
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
                    className="px-6 py-2.5 border border-foreground/40 text-muted-foreground hover:border-foreground hover:text-foreground font-mono text-[10px] tracking-[0.15em] uppercase transition-colors"
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
