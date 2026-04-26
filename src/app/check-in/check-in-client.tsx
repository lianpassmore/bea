'use client';

import { Suspense, useState, useEffect, useRef, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useConversation, ConversationProvider } from '@elevenlabs/react';
import PageBackground from '@/components/page-background';
import VoiceBars from '@/components/voice-bars';
import FamilyCheckIn from './family-check-in';
import { DEMO_SESSION_CAP_SECS } from '@/lib/auth';

interface TranscriptMessage {
  role: 'user' | 'agent';
  message: string;
  time_in_call_secs: number;
  source?: 'spoken' | 'typed';
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

type InputMode = 'talk' | 'chat';

function displayRole(role: string): string | null {
  if (role === 'primary') return 'Parent';
  return null;
}

function CheckInUI({ authedMember, individualVision, isDemo }: { authedMember: AuthedMember | null; individualVision: string | null; isDemo: boolean }) {
  const router = useRouter();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selection, setSelection] = useState<Selection>({ type: 'none' });
  const [pendingSelection, setPendingSelection] = useState<Selection | null>(null);
  const [inputMode, setInputMode] = useState<InputMode | null>(null);
  const [statusText, setStatusText] = useState('Taking note...');
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [streamingAgentText, setStreamingAgentText] = useState('');
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const transcriptRef = useRef<TranscriptMessage[]>([]);
  const startTimeRef = useRef<number>(0);
  const demoCapTimerRef = useRef<number | null>(null);

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
    textOnly: inputMode === 'chat',
    onConnect: () => {
      transcriptRef.current = [];
      setMessages([]);
      setStreamingAgentText('');
      startTimeRef.current = Date.now();
      setStatusText(inputMode === 'chat' ? 'Kia ora.' : 'I am here.');
      if (isDemo) {
        if (demoCapTimerRef.current) window.clearTimeout(demoCapTimerRef.current);
        demoCapTimerRef.current = window.setTimeout(() => {
          if (conversation.status === 'connected') conversation.endSession();
        }, DEMO_SESSION_CAP_SECS * 1000);
      }
    },
    onMessage: (msg: { source: 'user' | 'ai'; message: string }) => {
      const entry: TranscriptMessage = {
        role: msg.source === 'ai' ? 'agent' : 'user',
        message: msg.message,
        time_in_call_secs: (Date.now() - startTimeRef.current) / 1000,
      };
      // De-dupe against the last optimistic typed message: ElevenLabs may
      // (or may not) echo it back through onMessage.
      const last = transcriptRef.current[transcriptRef.current.length - 1];
      if (last && last.role === entry.role && last.message === entry.message) return;
      transcriptRef.current.push(entry);
      setMessages((prev) => [...prev, entry]);
      if (msg.source === 'ai') setStreamingAgentText('');
    },
    onAgentChatResponsePart: (part) => {
      if (part.type === 'start') setStreamingAgentText('');
      else if (part.type === 'delta') setStreamingAgentText((prev) => prev + part.text);
      else if (part.type === 'stop') setStreamingAgentText('');
    },
    onDisconnect: async () => {
      if (demoCapTimerRef.current) {
        window.clearTimeout(demoCapTimerRef.current);
        demoCapTimerRef.current = null;
      }
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

  async function startSessionWith(sel: Selection, mode: InputMode) {
    setSelection(sel);
    setInputMode(mode);
    setPendingSelection(null);
    setStatusText('Arriving...');
    try {
      if (mode === 'talk') {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      const dynamicVariables: Record<string, string> = { user_name: 'a visitor', user_member_id: '' };
      if (sel.type === 'member') {
        const ctx: Record<string, string> = await fetch(
          `/api/guardian/context?memberId=${sel.memberId}`
        )
          .then((r) => {
            if (!r.ok) throw new Error('context fetch failed');
            return r.json();
          })
          .catch((err) => {
            console.error('Guardian context fetch failed — proceeding with fallback:', err);
            return {};
          });
        Object.assign(dynamicVariables, {
          user_name: sel.memberName,
          user_member_id: sel.memberId,
          last_checkin_date: ctx.last_checkin_date ?? 'unknown',
          individual_summary: ctx.individual_summary ?? 'No previous check-in on record.',
          family_summary: ctx.family_summary ?? 'No family check-ins on record.',
          emotional_tone: ctx.emotional_tone ?? 'unknown',
          open_threads: ctx.open_threads ?? 'None on record.',
          listening_direction: ctx.listening_direction ?? 'Listen openly.',
          listening_priority: ctx.listening_priority ?? 'Listen for what has been heaviest lately.',
          household_vision: ctx.household_vision || 'Not yet set.',
          individual_vision: ctx.individual_vision || 'Not yet set.',
        });
      }
      conversation.startSession({
        agentId: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID!,
        dynamicVariables,
      });
    } catch {
      setStatusText('I could not arrive. Please try again.');
    }
  }

  function sendTyped(e?: FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const entry: TranscriptMessage = {
      role: 'user',
      message: text,
      time_in_call_secs: (Date.now() - startTimeRef.current) / 1000,
      source: 'typed',
    };
    transcriptRef.current.push(entry);
    setMessages((prev) => [...prev, entry]);
    conversation.sendUserMessage(text);
    setDraft('');
  }

  const isConnected = conversation.status === 'connected';
  const isConnecting = conversation.status === 'connecting';
  const inSession = selection.type !== 'none';
  const showModePicker = pendingSelection !== null && !inSession;

  // ── Mode picker (Talk · Chat) ───────────────────────────────────────
  if (showModePicker && pendingSelection) {
    const sel = pendingSelection;
    const greetName =
      sel.type === 'member' ? sel.memberName : authedMember?.name ?? null;
    return (
      <div className="flex flex-col flex-1 pt-12 pb-8 md:pt-20 md:pb-12 max-w-sm md:max-w-md lg:max-w-lg mx-auto w-full animate-fade-in">
        <PageBackground variant="witness" />

        <header className="mb-12 md:mb-16">
          <h1 className="font-serif text-2xl md:text-4xl text-bea-charcoal leading-tight">
            {greetName ? `How would you like to kōrero, ${greetName}?` : 'How would you like to kōrero?'}
          </h1>
          <p className="font-body text-base md:text-lg text-bea-olive mt-4 md:mt-6 leading-relaxed">
            Speak with me, or type. Either is welcome.
          </p>
        </header>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => startSessionWith(sel, 'talk')}
            className="group flex items-center justify-between py-5 px-6 rounded-full border border-bea-charcoal/20 bg-bea-milk/60 hover:bg-bea-amber/10 hover:border-bea-amber/60 transition-colors duration-300"
          >
            <span className="font-body italic text-xl md:text-2xl text-bea-charcoal">
              Talk
            </span>
            <span className="font-ui text-xs text-bea-blue/60 group-hover:text-bea-amber transition-colors duration-300">
              voice
            </span>
          </button>
          <button
            onClick={() => startSessionWith(sel, 'chat')}
            className="group flex items-center justify-between py-5 px-6 rounded-full border border-bea-charcoal/20 bg-bea-milk/60 hover:bg-bea-amber/10 hover:border-bea-amber/60 transition-colors duration-300"
          >
            <span className="font-body italic text-xl md:text-2xl text-bea-charcoal">
              Chat
            </span>
            <span className="font-ui text-xs text-bea-blue/60 group-hover:text-bea-amber transition-colors duration-300">
              text
            </span>
          </button>
        </div>

        <button
          onClick={() => setPendingSelection(null)}
          className="mt-10 self-start font-ui text-xs text-bea-blue hover:text-bea-charcoal transition-colors duration-500"
        >
          Back
        </button>
      </div>
    );
  }

  // ── Start screen (authenticated solo) ──────────────────────────────
  if (!inSession && authedMember) {
    return (
      <div className="flex flex-col flex-1 pt-12 pb-8 md:pt-20 md:pb-12 max-w-sm md:max-w-md lg:max-w-lg mx-auto w-full animate-fade-in">
        <PageBackground variant="witness" />

        {individualVision && (
          <div className="mb-8 md:mb-12 pb-6 md:pb-8 border-b border-bea-charcoal/20">
            <p className="font-ui text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-bea-blue mb-2 sm:mb-3">
              Your vision
            </p>
            <p className="font-body italic text-lg md:text-xl text-bea-charcoal leading-snug">
              &ldquo;{individualVision}&rdquo;
            </p>
          </div>
        )}

        <header className="mb-10 md:mb-16">
          <h1 className="font-serif text-2xl md:text-4xl text-bea-charcoal leading-tight">
            Kia ora, {authedMember.name}.
          </h1>
          <p className="font-body text-base md:text-lg text-bea-olive mt-4 md:mt-6 leading-relaxed">
            I&rsquo;m ready for your individual check-in when you are.
          </p>
          {isDemo && (
            <p className="font-ui text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-bea-blue/70 mt-6">
              Demo sessions are capped at 5 minutes.
            </p>
          )}
        </header>

        <button
          onClick={() =>
            setPendingSelection({
              type: 'member',
              memberId: authedMember.id,
              memberName: authedMember.name,
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
            I can't seem to find your whānau right now. Please wait a moment.
          </p>
        )}

        {members && (
          <div className="flex flex-col gap-2 animate-fade-in">
            {members.map((m) => {
              const roleLabel = displayRole(m.role);
              return (
                <button
                  key={m.id}
                  onClick={() =>
                    setPendingSelection({ type: 'member', memberId: m.id, memberName: m.name })
                  }
                  className="group flex items-center justify-between py-2.5 border-b border-bea-charcoal/10 hover:border-bea-amber/40 transition-colors duration-500"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-body text-lg md:text-2xl text-bea-charcoal group-hover:text-bea-amber transition-colors duration-500">
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
              onClick={() => setPendingSelection({ type: 'guest' })}
              className="group flex items-center justify-between py-2.5 border-b border-bea-charcoal/10 hover:border-bea-amber/40 transition-colors duration-500 mt-4"
            >
               <div className="flex items-center gap-3">
                  <span className="font-body text-lg md:text-2xl text-bea-charcoal group-hover:text-bea-amber transition-colors duration-500">
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

  // ── Active session: chat-only mode ─────────────────────────────────
  if (inputMode === 'chat') {
    return (
      <div className="flex flex-col flex-1 max-w-sm md:max-w-md lg:max-w-lg mx-auto w-full animate-fade-in">
        <PageBackground variant="witness" />

        <header className="pt-8 md:pt-12 pb-6">
          <h1 className="font-serif text-xl md:text-2xl text-bea-charcoal leading-tight">
            {statusText}
          </h1>
        </header>

        <div className="flex-1 overflow-y-auto pb-4 space-y-4">
          {messages.map((m, i) => (
            <MessageBubble key={i} role={m.role} message={m.message} />
          ))}
          {streamingAgentText && (
            <MessageBubble role="agent" message={streamingAgentText} />
          )}
        </div>

        <form onSubmit={sendTyped} className="pt-4 pb-6 border-t border-bea-charcoal/10">
          <div className="flex items-end gap-3">
            <textarea
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (isConnected) conversation.sendUserActivity();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendTyped();
                }
              }}
              disabled={!isConnected}
              placeholder={isConnected ? 'Write to Bea...' : 'Arriving...'}
              rows={1}
              className="flex-1 resize-none bg-transparent font-body text-base md:text-lg text-bea-charcoal placeholder:text-bea-blue/40 focus:outline-none py-2"
            />
            <button
              type="submit"
              disabled={!isConnected || !draft.trim()}
              className="font-ui text-sm text-bea-amber hover:text-bea-charcoal disabled:opacity-30 transition-colors duration-300 pb-2"
            >
              Send
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              if (isConnected) conversation.endSession();
              else router.push('/');
            }}
            disabled={isConnecting}
            className="mt-3 font-ui text-xs text-bea-blue hover:text-bea-charcoal transition-colors duration-500"
          >
            {isConnected ? 'Finish kōrero' : 'Cancel'}
          </button>
        </form>
      </div>
    );
  }

  // ── Active session: talk mode (with optional chat panel) ───────────
  return (
    <div className="flex flex-col items-center justify-between flex-1 py-12 md:py-20 max-w-sm md:max-w-md lg:max-w-lg mx-auto w-full animate-fade-in">
      <PageBackground variant="witness" />

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

      <div className="flex flex-col items-center gap-4">
        {isConnected && (
          <button
            onClick={() => setChatPanelOpen((v) => !v)}
            className="font-ui text-xs text-bea-blue hover:text-bea-charcoal transition-colors duration-500"
          >
            {chatPanelOpen ? 'Hide chat' : 'Show chat'}
          </button>
        )}
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
          {isConnected ? 'Finish kōrero' : 'Cancel'}
        </button>
      </div>

      {chatPanelOpen && (
        <ChatPanel
          messages={messages}
          streamingAgentText={streamingAgentText}
          draft={draft}
          setDraft={setDraft}
          onSend={sendTyped}
          onClose={() => setChatPanelOpen(false)}
          onTypingActivity={() => {
            if (isConnected) conversation.sendUserActivity();
          }}
          isConnected={isConnected}
        />
      )}
    </div>
  );
}

function MessageBubble({ role, message }: { role: 'user' | 'agent'; message: string }) {
  const isAgent = role === 'agent';
  return (
    <div className={`flex ${isAgent ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[85%] px-4 py-2.5 rounded-2xl font-body text-base leading-relaxed
          ${isAgent
            ? 'bg-bea-milk/80 text-bea-charcoal rounded-bl-sm'
            : 'bg-bea-amber/15 text-bea-charcoal rounded-br-sm'}
        `}
      >
        {message}
      </div>
    </div>
  );
}

function ChatPanel({
  messages,
  streamingAgentText,
  draft,
  setDraft,
  onSend,
  onClose,
  onTypingActivity,
  isConnected,
}: {
  messages: TranscriptMessage[];
  streamingAgentText: string;
  draft: string;
  setDraft: (s: string) => void;
  onSend: (e?: FormEvent) => void;
  onClose: () => void;
  onTypingActivity: () => void;
  isConnected: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streamingAgentText]);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 bg-bea-milk border-t border-bea-charcoal/20 shadow-[0_-12px_40px_-20px_rgba(0,0,0,0.25)] animate-fade-in">
      <div className="max-w-sm md:max-w-md lg:max-w-lg mx-auto px-6 py-4 flex flex-col h-[60vh]">
        <div className="flex items-center justify-between pb-3 border-b border-bea-charcoal/10">
          <p className="font-ui text-[10px] uppercase tracking-[0.2em] text-bea-blue">
            Chat
          </p>
          <button
            onClick={onClose}
            className="font-ui text-xs text-bea-blue hover:text-bea-charcoal transition-colors duration-500"
          >
            Hide
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto py-4 space-y-3">
          {messages.length === 0 && !streamingAgentText && (
            <p className="font-body italic text-sm text-bea-blue/60 text-center pt-8">
              Whatever you say or type will appear here.
            </p>
          )}
          {messages.map((m, i) => (
            <MessageBubble key={i} role={m.role} message={m.message} />
          ))}
          {streamingAgentText && (
            <MessageBubble role="agent" message={streamingAgentText} />
          )}
        </div>

        <form onSubmit={onSend} className="pt-3 border-t border-bea-charcoal/10">
          <div className="flex items-end gap-3">
            <textarea
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                onTypingActivity();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              disabled={!isConnected}
              placeholder="Type instead of speaking..."
              rows={1}
              className="flex-1 resize-none bg-transparent font-body text-base text-bea-charcoal placeholder:text-bea-blue/40 focus:outline-none py-2"
            />
            <button
              type="submit"
              disabled={!isConnected || !draft.trim()}
              className="font-ui text-sm text-bea-amber hover:text-bea-charcoal disabled:opacity-30 transition-colors duration-300 pb-2"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ModeChooser() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center px-6 animate-fade-in">
      <PageBackground variant="witness" />

      <div className="w-full max-w-xs flex flex-col items-center gap-10">
        <p className="font-body text-lg md:text-xl text-bea-olive text-center">
          Who&rsquo;s here today?
        </p>

        <div className="flex flex-col w-full gap-3">
          <Link
            href="/check-in?mode=individual"
            className="py-5 text-center rounded-full border border-bea-charcoal/20 bg-bea-milk/60 hover:bg-bea-amber/10 hover:border-bea-amber/60 transition-colors duration-300"
          >
            <span className="font-body italic text-xl md:text-2xl text-bea-charcoal">
              Just me
            </span>
          </Link>
          <Link
            href="/check-in?mode=family"
            className="py-5 text-center rounded-full border border-bea-charcoal/20 bg-bea-milk/60 hover:bg-bea-amber/10 hover:border-bea-amber/60 transition-colors duration-300"
          >
            <span className="font-body italic text-xl md:text-2xl text-bea-charcoal">
              Whānau
            </span>
          </Link>
        </div>

        <Link
          href="/"
          className="font-ui text-xs text-bea-blue hover:text-bea-charcoal transition-colors duration-500"
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}

function CheckInRouter({ authedMember, individualVision, householdVision, isDemo }: { authedMember: AuthedMember | null; individualVision: string | null; householdVision: string | null; isDemo: boolean }) {
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode');

  if (mode === 'family') {
    return <FamilyCheckIn householdVision={householdVision} isDemo={isDemo} />;
  }

  if (mode === 'individual') {
    return (
      <ConversationProvider>
        <CheckInUI authedMember={authedMember} individualVision={individualVision} isDemo={isDemo} />
      </ConversationProvider>
    );
  }

  return <ModeChooser />;
}

export default function CheckInClient({ authedMember, individualVision, householdVision, isDemo }: { authedMember: AuthedMember | null; individualVision: string | null; householdVision: string | null; isDemo: boolean }) {
  return (
    <Suspense fallback={null}>
      <CheckInRouter authedMember={authedMember} individualVision={individualVision} householdVision={householdVision} isDemo={isDemo} />
    </Suspense>
  );
}
