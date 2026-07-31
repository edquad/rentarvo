import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Send, Bot, User, Loader2, MessageSquare, Sparkles } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  data?: { columns: string[]; rows: Record<string, any>[] } | null;
  timestamp: Date;
}

const SUGGESTED = [
  'How many active tenants do I have?',
  'What is total income this month?',
  'Show leases expiring in next 90 days',
  'Which properties have the highest expenses?',
  'Show me all expenses over $500',
  'What is the total rent collected this year?',
];

export function ChatbotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: history } = useQuery({
    queryKey: ['chatbot-history'],
    queryFn: () => api.get<any[]>('/chatbot/history?limit=20'),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (history && messages.length === 0) {
      const restored: ChatMessage[] = [];
      for (const entry of history) {
        restored.push({
          id: entry.id + '-q',
          role: 'user',
          content: entry.rawText,
          timestamp: new Date(entry.createdAt),
        });
        const parsed = entry.parsedJson as any;
        if (parsed?.explanation || parsed?.answer) {
          restored.push({
            id: entry.id + '-a',
            role: 'assistant',
            content: parsed.answer || parsed.explanation || '',
            timestamp: new Date(entry.createdAt),
          });
        }
      }
      if (restored.length) setMessages(restored);
    }
  }, [history]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const askMutation = useMutation({
    mutationFn: (question: string) =>
      api.post<{ answer: string; data: { columns: string[]; rows: any[] } | null; question: string }>('/chatbot/ask', { question }),
    onSuccess: (res) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + '-a',
          role: 'assistant',
          content: res.answer,
          data: res.data,
          timestamp: new Date(),
        },
      ]);
    },
    onError: (err: any) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + '-err',
          role: 'assistant',
          content: err.message || 'Something went wrong. Please try again.',
          timestamp: new Date(),
        },
      ]);
    },
  });

  const handleSend = (text?: string) => {
    const question = (text || input).trim();
    if (!question || askMutation.isPending) return;

    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString() + '-q', role: 'user', content: question, timestamp: new Date() },
    ]);
    setInput('');
    askMutation.mutate(question);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isEmpty = messages.length === 0 && !askMutation.isPending;

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] lg:h-[calc(100dvh-3.5rem)]">
      {/* Header */}
      <div className="px-4 lg:px-6 py-3 border-b bg-white shrink-0">
        <div className="flex items-center gap-2 max-w-4xl mx-auto">
          <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center">
            <Sparkles size={18} className="text-brand-700" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Rentarvo Assistant</h1>
            <p className="text-xs text-gray-500">Ask anything about your properties, tenants, and finances</p>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 lg:px-6 py-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {isEmpty && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mb-4">
                <MessageSquare size={32} className="text-brand-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-700 mb-1">Ask me anything</h2>
              <p className="text-sm text-gray-500 mb-8 max-w-md">
                I can look up tenants, leases, income, expenses, and property details from your Rentarvo data.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {SUGGESTED.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSend(s)}
                    className="text-left px-4 py-3 rounded-xl border border-gray-200 hover:border-brand-300 hover:bg-brand-50 text-sm text-gray-700 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot size={16} className="text-brand-700" />
                </div>
              )}
              <div className={`max-w-[85%] lg:max-w-[70%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                <div
                  className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-brand-700 text-white rounded-br-md'
                      : 'bg-gray-100 text-gray-800 rounded-bl-md'
                  }`}
                >
                  {msg.content}
                </div>
                {msg.data && msg.data.rows.length > 0 && (
                  <div className="mt-2 border rounded-xl overflow-hidden bg-white shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b">
                            {msg.data.columns.map((col) => (
                              <th key={col} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                {col.replace(/_/g, ' ')}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {msg.data.rows.slice(0, 20).map((row, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              {msg.data!.columns.map((col) => (
                                <td key={col} className="px-3 py-2 whitespace-nowrap text-gray-700">
                                  {formatCell(row[col])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {msg.data.rows.length > 20 && (
                      <p className="px-3 py-2 text-xs text-gray-400 border-t">
                        Showing 20 of {msg.data.rows.length} rows
                      </p>
                    )}
                  </div>
                )}
                <p className="text-[10px] text-gray-400 mt-1 px-1">
                  {msg.timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center shrink-0 mt-0.5">
                  <User size={16} className="text-gray-600" />
                </div>
              )}
            </div>
          ))}

          {askMutation.isPending && (
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center shrink-0">
                <Bot size={16} className="text-brand-700" />
              </div>
              <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-md">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 size={14} className="animate-spin" />
                  Looking that up...
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input area */}
      <div className="border-t bg-white px-4 lg:px-6 py-3 shrink-0">
        <div className="max-w-4xl mx-auto flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about tenants, rent, expenses..."
            disabled={askMutation.isPending}
            className="flex-1 px-4 py-3 border rounded-xl bg-white focus:ring-2 focus:ring-brand-500 outline-none text-sm disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!input.trim() || askMutation.isPending}
            className="px-4 py-3 bg-brand-700 text-white rounded-xl hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function formatCell(value: any): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'number') {
    if (Number.isInteger(value) && value > 100) return value.toLocaleString();
    if (!Number.isInteger(value)) return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return String(value);
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return String(value);
}
