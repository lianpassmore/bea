'use client';

import { useRef, useState } from 'react';
import { Mic } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useConversation, ConversationProvider } from '@elevenlabs/react';

interface TranscriptMessage {
  role: 'user' | 'agent';
  message: string;
  time_in_call_secs: number;
}

function CheckInUI() {
  const router = useRouter();
  const [statusText, setStatusText] = useState("Ready when you are.");
  const transcriptRef = useRef<TranscriptMessage[]>([]);
  const startTimeRef = useRef<number>(0);

  const saveTranscript = async (transcript: TranscriptMessage[]) => {
    if (transcript.length === 0) return;
    try {
      await fetch('/api/check-ins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          agent_id: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID,
          started_at: new Date(startTimeRef.current).toISOString(),
          call_duration_secs: (Date.now() - startTimeRef.current) / 1000,
        }),
      });
    } catch (err) {
      console.error('Failed to save transcript:', err);
    }
  };

  const conversation = useConversation({
    onConnect: () => {
      transcriptRef.current = [];
      startTimeRef.current = Date.now();
      setStatusText("Bea is listening...");
    },
    onMessage: (msg: { source: 'user' | 'ai'; message: string }) => {
      transcriptRef.current.push({
        role: msg.source === 'ai' ? 'agent' : 'user',
        message: msg.message,
        time_in_call_secs: (Date.now() - startTimeRef.current) / 1000,
      });
    },
    onDisconnect: async () => {
      setStatusText("Session ended. Saving to journal...");
      await saveTranscript(transcriptRef.current);
      setTimeout(() => router.push('/'), 2000);
    },
    onError: (error: any) => {
      console.error('ElevenLabs Error:', error);
      setStatusText("Network error. Please try again.");
    },
  });

  const toggleConversation = async () => {
    if (conversation.status === 'connected') {
      await conversation.endSession();
    } else {
      setStatusText("Connecting to Bea...");
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        await conversation.startSession({
          agentId: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID!,
        });
      } catch (error) {
        console.error("Failed to start session:", error);
        setStatusText("Microphone access denied.");
      }
    }
  };

  const isConnected = conversation.status === 'connected';
  const isConnecting = conversation.status === 'connecting';

  return (
    <div className="flex flex-col items-center justify-between h-[80vh] pt-20">

      {/* Top: Status */}
      <div className="text-center w-full px-6">
        <h1 className="font-serif text-3xl text-bea-charcoal mb-4 transition-all">
          {statusText}
        </h1>
        {isConnected && (
          <p className="font-body text-bea-olive text-lg italic animate-pulse">
            Speak naturally. Bea is listening.
          </p>
        )}
      </div>

      {/* Center: The Pulse/Mic */}
      <div className="flex-1 flex items-center justify-center">
        <button
          onClick={toggleConversation}
          disabled={isConnecting}
          className={`relative flex items-center justify-center w-32 h-32 rounded-full transition-all duration-700 ease-in-out ${
            isConnected
              ? 'bg-bea-amber/20 scale-110'
              : 'bg-bea-milk border border-bea-amber/30 shadow-sm hover:bg-bea-amber/10'
          } ${isConnecting ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isConnected && conversation.isSpeaking && (
            <div className="absolute inset-0 rounded-full bg-bea-amber/40 animate-ping opacity-75 pointer-events-none"></div>
          )}
          <Mic className={`w-8 h-8 ${isConnected ? 'text-bea-amber' : 'text-bea-olive'}`} />
        </button>
      </div>

      {/* Bottom: End Session */}
      <div className="pb-10">
        <button
          onClick={async () => {
            if (conversation.status === 'connected') await conversation.endSession();
            router.push('/');
          }}
          className="font-ui text-sm tracking-wide uppercase text-bea-blue hover:text-bea-charcoal transition-colors"
        >
          {isConnected ? "End Check-in" : "Cancel"}
        </button>
      </div>
    </div>
  );
}

export default function CheckInPage() {
  return (
    <ConversationProvider>
      <CheckInUI />
    </ConversationProvider>
  );
}
