'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useConversation, ConversationProvider } from '@elevenlabs/react';
import PageBackground from '@/components/page-background';
import VoiceBars from '@/components/voice-bars';
import FamilyCheckIn from './family-check-in';

interface TranscriptMessage {
  role: 'user' | 'agent';
  message: string;
  time_in_call_secs: number;
}

interface Member {
  id: string;
  name: string;
  role: string;
  status: string;
}

type AuthedMember = { id: string; name: string; role: string };

type Selection =
  | { type: 'none' }
  | { type: 'member'; memberId: string; memberName: string }
  | { type: 'guest' };

function displayRole(role: string): string | null {
  if (role === 'primary') return 'Parent';
  return null;
}

function CheckInUI({ authedMember }: { authedMember: AuthedMember | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isFamilyMode = searchParams.get('mode') === 'family';
  const [members, setMembers] = useState<Member[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selection, setSelection] = useState<Selection>({ type: 'none' });
  const [statusText, setStatusText] = useState('Taking note...');
  const transcriptRef = useRef<TranscriptMessage[]>([]);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (authedMember) return;
    fetch('/api/members')
      .then((r) => {
        if (!r.ok) throw new Error('members fetch failed');
        return r.json() as Promise<Member[]>;
      })
      .then((data) => setMembers(data.filter((m) => m.status === 'active')))
      .catch(() => setLoadError(true));
  }, [authedMember]);

  const saveTranscript = async (
    transcript: TranscriptMessage[],
    memberId?: string,
    memberName?: string,
    isGuest = false
  ) => {
    if (transcript.length === 0) return;
    if (isGuest) return; 
    try {
      await fetch('/api/check-ins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          agent_id: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID,
          started_at: new Date(startTimeRef.current).toISOString(),
          call_duration_secs: (Date.now() - startTimeRef.current) / 1000,
          member_id: memberId ?? null,
          member_name: memberName ?? null,
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
      setStatusText('I am here.');
    },
    onMessage: (msg: { source: 'user' | 'ai'; message: string }) => {
      transcriptRef.current.push({
        role: msg.source === 'ai' ? 'agent' : 'user',
        message: msg.message,
        time_in_call_secs: (Date.now() - startTimeRef.current) / 1000,
      });
    },
    onDisconnect: async () => {
      setStatusText('Taking note of what I heard...');
      const isMember = selection.type === 'member';
      await saveTranscript(
        transcriptRef.current,
        isMember ? selection.memberId : undefined,
        isMember ? selection.memberName : undefined,
        selection.type === 'guest'
      );
      setTimeout(() => router.push('/'), 2000);
    },
    onError: (error: unknown) => {
      console.error('ElevenLabs Error:', error);
      setStatusText('Something stopped us.');
    },
  });

  async function startSessionForMember(member: Member) {
    setSelection({ type: 'member', memberId: member.id, memberName: member.name });
    setStatusText('Arriving...');
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx: Record<string, string> = await fetch(
        `/api/guardian/context?memberId=${member.id}`
      )
        .then((r) => {
          if (!r.ok) throw new Error('context fetch failed');
          return r.json();
        })
        .catch((err) => {
          console.error('Guardian context fetch failed — proceeding with fallback:', err);
          return {};
        });
      conversation.startSession({
        agentId: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID!,
        dynamicVariables: {
          user_name: member.name,
          user_member_id: member.id,
          last_checkin_date: ctx.last_checkin_date ?? 'unknown',
          individual_summary: ctx.individual_summary ?? 'No previous check-in on record.',
          family_summary: ctx.family_summary ?? 'No family check-ins on record.',
          emotional_tone: ctx.emotional_tone ?? 'unknown',
          open_threads: ctx.open_threads ?? 'None on record.',
          listening_direction: ctx.listening_direction ?? 'Listen openly.',
          listening_priority: ctx.listening_priority ?? 'Listen for what has been heaviest lately.',
        },
      });
    } catch {
      setStatusText('I could not arrive. Please try again.');
    }
  }

  async function startSessionAsGuest() {
    setSelection({ type: 'guest' });
    setStatusText('Arriving...');
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      conversation.startSession({
        agentId: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID!,
        dynamicVariables: { user_name: 'a visitor', user_member_id: '' },
      });
    } catch {
      setStatusText('I could not arrive. Please try again.');
    }
  }

  const isConnected = conversation.status === 'connected';
  const isConnecting = conversation.status === 'connecting';
  const inSession = selection.type !== 'none';

  // ── Start screen (authenticated solo) ──────────────────────────────
  if (!inSession && authedMember) {
    return (
      <div className="flex flex-col flex-1 pt-12 pb-8 md:pt-20 md:pb-12 max-w-sm md:max-w-md lg:max-w-lg mx-auto w-full animate-fade-in">
        <PageBackground variant="witness" />

        <header className="mb-10 md:mb-16">
          <h1 className="font-serif text-2xl md:text-4xl text-bea-charcoal leading-tight">
            {isFamilyMode ? 'Hello, family.' : `Hello, ${authedMember.name}.`}
          </h1>
          <p className="font-body text-base md:text-lg text-bea-olive mt-4 md:mt-6 leading-relaxed">
            {isFamilyMode
              ? "I'm ready for your check-in when you are."
              : "I'm ready for your individual check-in when you are."}
          </p>
        </header>

        <button
          onClick={() =>
            startSessionForMember({
              id: authedMember.id,
              name: authedMember.name,
              role: authedMember.role,
              status: 'active',
            })
          }
          className="group inline-flex items-center gap-4 font-body text-base md:text-lg text-bea-charcoal transition-opacity hover:opacity-70"
        >
          <span className="h-px w-8 bg-bea-amber transition-all duration-700 group-hover:w-16"></span>
          Begin
        </button>
      </div>
    );
  }

  // ── Selection view (fallback: unlinked / guest-only) ────────────────
  if (!inSession) {
    return (
      <div className="flex flex-col flex-1 pt-12 pb-8 md:pt-20 md:pb-12 max-w-sm md:max-w-md lg:max-w-lg mx-auto w-full animate-fade-in">
        <PageBackground variant="witness" />

        <header className="mb-10 md:mb-16 space-y-6">
          <h1 className="font-serif text-2xl md:text-4xl text-bea-charcoal leading-tight">
            Who is here?
          </h1>
        </header>

        {loadError && (
          <p className="font-body text-base md:text-lg text-bea-clay">
            I can't seem to find your family right now. Please wait a moment.
          </p>
        )}

        {members && (
          <div className="flex flex-col gap-2 animate-fade-in">
            {members.map((m) => {
              const roleLabel = displayRole(m.role);
              return (
                <button
                  key={m.id}
                  onClick={() => startSessionForMember(m)}
                  className="group flex items-center justify-between py-2.5 border-b border-bea-charcoal/10 hover:border-bea-amber/40 transition-colors duration-500"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-serif text-lg md:text-2xl text-bea-charcoal group-hover:text-bea-amber transition-colors duration-500">
                      {m.name}
                    </span>
                    {roleLabel && (
                      <span className="font-ui text-xs md:text-sm text-bea-blue/50">
                        ({roleLabel})
                      </span>
                    )}
                  </div>
                  <span className="font-ui text-xs text-bea-amber opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    Select
                  </span>
                </button>
              );
            })}

            <button
              onClick={startSessionAsGuest}
              className="group flex items-center justify-between py-2.5 border-b border-bea-charcoal/10 hover:border-bea-amber/40 transition-colors duration-500 mt-4"
            >
               <div className="flex items-center gap-3">
                  <span className="font-serif text-lg md:text-2xl text-bea-charcoal group-hover:text-bea-amber transition-colors duration-500">
                    A guest
                  </span>
                  <span className="font-ui text-xs md:text-sm text-bea-blue/50">
                    (Unrecorded)
                  </span>
                </div>
                <span className="font-ui text-xs text-bea-amber opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  Select
                </span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Active session view ─────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center justify-between flex-1 py-12 md:py-20 max-w-sm md:max-w-md lg:max-w-lg mx-auto w-full animate-fade-in">
      <PageBackground variant="witness" />

      {/* 1. Status Text (Replaced standard error phrasing with first-person Bea text) */}
      <div className="text-center w-full space-y-4">
        <h1 className="font-serif text-2xl md:text-4xl text-bea-charcoal leading-tight transition-all duration-700">
          {statusText}
        </h1>
        {isConnected && (
          <p className="font-body text-base md:text-lg text-bea-olive italic transition-opacity duration-500">
             {conversation.isSpeaking ? 'I am speaking.' : 'I am listening.'}
          </p>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center w-full my-16">
        {isConnected ? (
          <VoiceBars
            getFrequencyData={() =>
              conversation.isSpeaking
                ? conversation.getOutputByteFrequencyData()
                : conversation.getInputByteFrequencyData()
            }
          />
        ) : (
          <div
            className={`transition-all duration-700 ease-in-out rounded-full
              ${isConnecting ? 'w-4 h-4 bg-bea-blue/30 animate-pulse' : 'w-4 h-4 bg-transparent'}
            `}
          />
        )}
      </div>

      {/* 3. The Action (Replaced ALL CAPS with soft, unhurried text) */}
      <div className="flex flex-col items-center">
        <button
          onClick={async () => {
            if (conversation.status === 'connected') conversation.endSession();
            else router.push('/');
          }}
          disabled={isConnecting}
          className={`font-ui text-sm text-bea-blue hover:text-bea-charcoal transition-colors duration-500
            ${isConnecting ? 'opacity-0' : 'opacity-100'}
          `}
        >
          {isConnected ? 'Finish conversation' : 'Cancel'}
        </button>
      </div>
      
    </div>
  );
}

function CheckInRouter({ authedMember }: { authedMember: AuthedMember | null }) {
  const searchParams = useSearchParams();
  const isFamilyMode = searchParams.get('mode') === 'family';

  if (isFamilyMode) {
    return <FamilyCheckIn />;
  }

  return (
    <ConversationProvider>
      <CheckInUI authedMember={authedMember} />
    </ConversationProvider>
  );
}

export default function CheckInClient({ authedMember }: { authedMember: AuthedMember | null }) {
  return (
    <Suspense fallback={null}>
      <CheckInRouter authedMember={authedMember} />
    </Suspense>
  );
}