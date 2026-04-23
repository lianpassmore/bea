'use client';

import { useState } from 'react';
import { Mic } from 'lucide-react';
import { useRouter } from 'next/navigation';
// NEW: We imported ConversationProvider
import { useConversation, ConversationProvider } from '@elevenlabs/react';

// 1. This is your UI and Logic (The "Child")
function CheckInUI() {
  const router = useRouter();
  const [statusText, setStatusText] = useState("Ready when you are.");

  // Initialize the ElevenLabs Agent
  const conversation = useConversation({
    onConnect: () => {
      setStatusText("Bea is listening...");
    },
    onDisconnect: () => {
      setStatusText("Session ended. Saving to journal...");
      setTimeout(() => router.push('/'), 2000);
    },
    onError: (error: any) => {
      console.error('ElevenLabs Error:', error);
      setStatusText("Network error. Please try again.");
    }
  });

  const toggleConversation = async () => {
    if (conversation.status === 'connected') {
      await conversation.endSession();
    } else {
      setStatusText("Connecting to Bea...");
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        
        await conversation.startSession({
          agentId: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID!
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

// 2. This is the Page (The "Parent" Wrapper)
export default function CheckInPage() {
  return (
    <ConversationProvider>
      <CheckInUI />
    </ConversationProvider>
  );
}