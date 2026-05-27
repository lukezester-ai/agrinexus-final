'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import AnimatedDebateTimeline from '@/components/AnimatedDebateTimeline';

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  isDebate?: boolean;
  debateData?: any;
}

export default function TutorChat() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      supabase.from('farm_profiles').select('*').eq('user_id', user.id).single()
        .then(({ data }) => {
          if (data) {
             setProfile(data);
             setMessages([{
               id: '1',
               role: 'ai',
               content: `Здравейте, ${data.full_name?.split(' ')[0] || 'Фермер'}! Аз съм AgriNexus Tutor. 🌾\nМога да ви помогна с бързи съвети за вашето стопанство или да направя задълбочен дебат (Deep Analysis) с екип от AI специалисти за важни стратегически решения.`
             }]);
          }
        });
    }
  }, [user]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const sendMessage = async (isDeepAnalysis: boolean) => {
    if (!input.trim() || !profile || loading) return;

    const newMsgId = Date.now().toString();
    const userMsg: ChatMessage = { id: newMsgId, role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const endpoint = isDeepAnalysis 
          ? 'http://localhost:8000/api/tutor/deep-debate' 
          : 'http://localhost:8000/api/tutor/chat';
      
      const payload = {
        question: userMsg.content,
        user_id: user.id,
        culture: profile.cultures?.[0] || '',
        region: profile.region || ''
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Грешка при връзка с бекенда');
      
      const data = await res.json();
      
      if (isDeepAnalysis) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'ai',
          content: '',
          isDebate: true,
          debateData: data
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'ai',
          content: data.answer
        }]);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'ai',
        content: 'Възникна грешка при свързване с AgriNexus AI. Уверете се, че бекендът (FastAPI) работи на порт 8000.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 pt-16"> {/* Добавен padding-top заради header-а, ако има глобален */}
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center gap-3 shadow-sm z-10">
        <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-green-600">
          <Bot size={24} />
        </div>
        <div>
          <h1 className="font-bold text-gray-800 text-lg">AgriNexus Tutor</h1>
          <p className="text-sm text-green-600 font-medium flex items-center gap-1">
             <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            Онлайн и в готовност
          </p>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 max-w-5xl mx-auto w-full">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
              {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
            </div>
            <div className={`max-w-[85%] ${msg.role === 'user' ? 'bg-blue-600 text-white shadow-md' : 'bg-white border border-gray-100 shadow-sm'} rounded-2xl p-5 text-[15.5px] leading-relaxed`}>
              {msg.isDebate && msg.debateData ? (
                 <AnimatedDebateTimeline 
                    debateHistory={msg.debateData.debate_history}
                    finalAnswer={msg.debateData.final_answer}
                    consensusLevel={msg.debateData.consensus_level}
                 />
              ) : (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-4">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600">
               <Bot size={20} />
            </div>
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5 flex items-center gap-2">
               <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-bounce"></div>
               <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
               <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
               <span className="text-gray-400 ml-2 text-sm">Агентите мислят...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Input Area */}
      <div className="bg-white border-t p-4 sm:p-6 shadow-lg z-10">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row gap-3 relative">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && sendMessage(false)}
            placeholder="Напр: Да продавам ли пшеницата сега или да чакам?"
            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 outline-none focus:ring-2 focus:ring-green-500 transition-all text-[16px]"
            disabled={loading}
          />
          <div className="flex gap-2 shrink-0">
            <button 
              onClick={() => sendMessage(false)}
              disabled={loading || !input.trim()}
              className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-6 py-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 border border-gray-200"
              title="Бърз отговор"
            >
              <Send size={20} /> <span className="hidden sm:inline">Бърз</span>
            </button>
            <button 
              onClick={() => sendMessage(true)}
              disabled={loading || !input.trim()}
              className="bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-50"
              title="Задълбочен дебат (Market, Risk, Crop & Critic Expert)"
            >
              <Sparkles size={20} className="animate-pulse" /> 
              <span>Deep Analysis</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
