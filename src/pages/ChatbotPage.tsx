import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Eraser, MessageSquarePlus, Send, Trash2 } from 'lucide-react';
import { MarkdownView } from '../components/MarkdownView';
import { SkeletonRows } from '../components/Skeleton';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import type { ChatMessage, ChatSession, DocumentSummaryItem } from '../types';

const SUBJECT_PRESETS = [
  'General',
  'Computer Science',
  'Mathematics',
  'Physics',
  'Biology',
  'Chemistry',
  'Economics',
  'History',
  'Literature',
];

const FOLLOW_UP_PROMPTS = [
  'Give me a real-world example of this.',
  'Explain that again in simpler terms.',
  'What are common exam pitfalls on this topic?',
];

export function ChatbotPage() {
  const { notify } = useToast();

  const [chats, setChats] = useState<ChatSession[]>([]);
  const [docs, setDocs] = useState<DocumentSummaryItem[]>([]);
  const [activeChat, setActiveChat] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  // New chat controls
  const [newSubject, setNewSubject] = useState('Computer Science');
  const [newMode, setNewMode] = useState<'detailed' | 'beginner'>('detailed');
  const [newDocId, setNewDocId] = useState('');
  const [input, setInput] = useState('');

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const selectChat = useCallback(
    async (chat: ChatSession) => {
      setActiveChat(chat);
      setLoadingMessages(true);
      try {
        const res = await apiRequest<{ chat: ChatSession; messages: ChatMessage[] }>(
          `/api/chats/${chat._id}`
        );
        setActiveChat(res.chat);
        setMessages(res.messages);
      } catch (err) {
        notify(err instanceof Error ? err.message : 'Could not load conversation.', 'error');
      } finally {
        setLoadingMessages(false);
      }
    },
    [notify]
  );

  useEffect(() => {
    let mounted = true;
    Promise.all([
      apiRequest<{ chats: ChatSession[] }>('/api/chats'),
      apiRequest<{ documents: DocumentSummaryItem[] }>('/api/documents'),
    ])
      .then(([chatRes, docRes]) => {
        if (!mounted) return;
        setChats(chatRes.chats);
        setDocs(docRes.documents);
        if (chatRes.chats.length > 0) {
          selectChat(chatRes.chats[0]);
        }
      })
      .catch((err) => {
        if (mounted) {
          notify(err instanceof Error ? err.message : 'Failed to initialize AI Tutor.', 'error');
        }
      })
      .finally(() => {
        if (mounted) setLoadingChats(false);
      });
    return () => {
      mounted = false;
    };
  }, [notify, selectChat]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  async function handleCreateChat() {
    try {
      const res = await apiRequest<{ chat: ChatSession }>('/api/chats', {
        method: 'POST',
        body: JSON.stringify({
          subject: newSubject,
          mode: newMode,
          documentId: newDocId || null,
          title: `${newSubject} Session`,
        }),
      });
      setChats((prev) => [res.chat, ...prev]);
      setActiveChat(res.chat);
      setMessages([]);
      notify(`Started new ${newSubject} conversation.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not create conversation.', 'error');
    }
  }

  async function sendMessageText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    let targetChat = activeChat;
    if (!targetChat) {
      try {
        const created = await apiRequest<{ chat: ChatSession }>('/api/chats', {
          method: 'POST',
          body: JSON.stringify({
            subject: newSubject,
            mode: newMode,
            documentId: newDocId || null,
            title: trimmed.slice(0, 60),
          }),
        });
        targetChat = created.chat;
        setChats((prev) => [created.chat, ...prev]);
        setActiveChat(created.chat);
      } catch (err) {
        notify(err instanceof Error ? err.message : 'Failed to start chat.', 'error');
        return;
      }
    }

    const optimisticId = `temp-${Date.now()}`;
    const optimisticUser: ChatMessage = {
      _id: optimisticId,
      chatId: targetChat._id,
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setInput('');
    setSending(true);

    try {
      const res = await apiRequest<{
        userMessage: ChatMessage;
        assistantMessage: ChatMessage;
        chatTitle: string;
      }>(`/api/chats/${targetChat._id}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          content: trimmed,
          mode: targetChat.mode,
        }),
      });

      setMessages((prev) => [
        ...prev.filter((m) => m._id !== optimisticId),
        res.userMessage,
        res.assistantMessage,
      ]);
      setChats((prev) =>
        prev.map((c) => (c._id === targetChat!._id ? { ...c, title: res.chatTitle } : c))
      );
      setActiveChat((prev) => (prev ? { ...prev, title: res.chatTitle } : prev));
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m._id !== optimisticId));
      setInput(trimmed);
      notify(err instanceof Error ? err.message : 'AI Tutor could not respond.', 'error');
    } finally {
      setSending(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await sendMessageText(input);
  }

  async function handleClearChat() {
    if (!activeChat) return;
    try {
      await apiRequest(`/api/chats/${activeChat._id}/messages`, { method: 'DELETE' });
      setMessages([]);
      notify('Conversation messages cleared.', 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not clear messages.', 'error');
    }
  }

  async function handleDeleteChat(id: string) {
    try {
      await apiRequest(`/api/chats/${id}`, { method: 'DELETE' });
      const remaining = chats.filter((c) => c._id !== id);
      setChats(remaining);
      if (activeChat?._id === id) {
        if (remaining.length > 0) {
          await selectChat(remaining[0]);
        } else {
          setActiveChat(null);
          setMessages([]);
        }
      }
      notify('Conversation deleted.', 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not delete conversation.', 'error');
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[calc(100vh-8.5rem)]">
      {/* Left Sidebar: New Conversation & History */}
      <aside className="lg:col-span-4 xl:col-span-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-4">
        <div className="space-y-3 pb-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            New Study Session
          </h2>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
              Subject
            </label>
            <select
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
            >
              {SUBJECT_PRESETS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
              Explanation Style
            </label>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setNewMode('detailed')}
                className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                  newMode === 'detailed'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Detailed
              </button>
              <button
                type="button"
                onClick={() => setNewMode('beginner')}
                className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                  newMode === 'beginner'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Beginner
              </button>
            </div>
          </div>

          {docs.length > 0 && (
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                Reference PDF (Optional)
              </label>
              <select
                value={newDocId}
                onChange={(e) => setNewDocId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="">None (General Academic)</option>
                {docs.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={handleCreateChat}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 text-xs font-medium transition-colors"
          >
            <MessageSquarePlus className="w-4 h-4" />
            <span>Start Conversation</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 px-1 mb-2">
            Conversation History
          </p>
          {loadingChats ? (
            <SkeletonRows count={4} />
          ) : chats.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 px-1 py-4">
              No saved chats yet. Ask a question on the right to begin.
            </p>
          ) : (
            chats.map((chat) => {
              const isSelected = activeChat?._id === chat._id;
              return (
                <div
                  key={chat._id}
                  className={`group flex items-center justify-between gap-2 rounded-lg px-3 py-2 transition-colors ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectChat(chat)}
                    className="flex-1 text-left min-w-0"
                  >
                    <p className="text-xs font-medium truncate">{chat.title}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {chat.subject} · {chat.mode === 'beginner' ? 'Beginner' : 'Detailed'}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteChat(chat._id)}
                    className="opacity-70 hover:opacity-100 text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-1"
                    aria-label="Delete conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Chat Panel */}
      <section className="lg:col-span-8 xl:col-span-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {activeChat ? activeChat.title : `${newSubject} Study Assistant`}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {activeChat
                ? `${activeChat.subject} · ${
                    activeChat.mode === 'beginner' ? 'Simple Beginner Mode' : 'Detailed Academic Mode'
                  }`
                : 'Select a subject and ask any academic question'}
            </p>
          </div>

          {activeChat && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() =>
                    setActiveChat((prev) => (prev ? { ...prev, mode: 'detailed' } : prev))
                  }
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    activeChat.mode === 'detailed'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Detailed
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActiveChat((prev) => (prev ? { ...prev, mode: 'beginner' } : prev))
                  }
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    activeChat.mode === 'beginner'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Beginner
                </button>
              </div>
              <button
                type="button"
                onClick={handleClearChat}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 max-h-[60vh] lg:max-h-[calc(100vh-19rem)]">
          {loadingMessages ? (
            <SkeletonRows count={4} />
          ) : messages.length === 0 ? (
            <div className="py-12 max-w-xl mx-auto text-center space-y-4">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Ask your AI Tutor anything
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Get rigorous derivations, intuition-first beginner walkthroughs, or answers grounded
                in your uploaded lecture PDFs.
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                {[
                  'Explain Bayes Theorem with an intuitive medical test example',
                  'Walk me through Big-O notation for recursion trees',
                  'Summarize the causes and phases of cellular respiration',
                ].map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => sendMessageText(starter)}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors text-left"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg._id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-3xl rounded-xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white text-sm'
                      : 'border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 w-full'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  ) : (
                    <MarkdownView content={msg.content} />
                  )}
                </div>
              </div>
            ))
          )}

          {sending && (
            <div className="max-w-xl rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
              Thinking through your question...
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Follow-up Prompts + Composer */}
        <div className="border-t border-slate-200 dark:border-slate-800 p-4 space-y-3 bg-slate-50/70 dark:bg-slate-950/40">
          {messages.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {FOLLOW_UP_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={sending}
                  onClick={() => sendMessageText(p)}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex items-center gap-2.5">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask an academic question or follow up..."
              className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0"
            >
              <Send className="w-4 h-4" />
              <span>Send</span>
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
