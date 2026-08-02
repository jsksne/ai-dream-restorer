"use client";

import { useSpeechCompanion } from "@/hooks/useSpeechCompanion";

interface VoiceHoldButtonProps {
  onTranscript: (text: string) => void;
  onUnsupported?: (message: string) => void;
  disabled?: boolean;
}

export function VoiceHoldButton({ onTranscript, onUnsupported, disabled = false }: VoiceHoldButtonProps) {
  const { supported, isListening, start, stop } = useSpeechCompanion({
    onTranscript,
    onError: onUnsupported,
  });
  return (
    <button
      type="button"
      aria-label={supported ? "按住说话" : "浏览器不支持语音输入"}
      aria-pressed={isListening}
      title={supported ? "按住说话，松开后加入输入框" : "当前浏览器不支持语音输入，请直接输入文字"}
      disabled={disabled}
      onPointerDown={(event) => {
        event.preventDefault();
        start();
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === " ") && !event.repeat) {
          event.preventDefault();
          start();
        }
      }}
      onKeyUp={(event) => {
        if (event.key === "Enter" || event.key === " ") stop();
      }}
      className={`shrink-0 rounded-md border px-2 py-1.5 text-xs transition-colors ${
        isListening
          ? "border-[color:var(--lavender)] bg-[color:var(--lavender-soft)] text-[color:var(--lavender-bright)]"
          : "border-[color:var(--border)] text-[color:var(--foreground-subtle)] hover:border-[color:var(--lavender)]"
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {isListening ? "松开发送" : "语音"}
    </button>
  );
}