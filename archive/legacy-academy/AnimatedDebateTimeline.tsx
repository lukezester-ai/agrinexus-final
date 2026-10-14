'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, Pause } from 'lucide-react';

interface AgentMessage {
  agent: string;
  content: string;
  round?: number;
}

interface AnimatedDebateProps {
  debateHistory: AgentMessage[];
  currentRound?: number;
  maxRounds?: number;
  finalAnswer?: string;
  consensusLevel?: string;
}

export default function AnimatedDebateTimeline({
  debateHistory,
  currentRound = 1,
  maxRounds = 1,
  finalAnswer,
  consensusLevel
}: AnimatedDebateProps) {
  
  const [step, setStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showFinal, setShowFinal] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!isPlaying) return;

    const timer = setTimeout(() => {
      if (step < debateHistory.length) {
        setStep(step + 1);
        
        // Auto-scroll към активния елемент
        setTimeout(() => {
            itemRefs.current[step]?.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center' 
            });
        }, 100);
        
      } else {
        setShowFinal(true);
        setIsPlaying(false);
        // Scroll to final answer
        setTimeout(() => {
            itemRefs.current[debateHistory.length]?.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center' 
            });
        }, 100);
      }
    }, 1500); // скорост на анимацията

    return () => clearTimeout(timer);
  }, [step, isPlaying, debateHistory.length]);

  const progress = ((currentRound - 1) / maxRounds) * 100;

  const getAgentIconAndColor = (agent: string) => {
    switch(agent.toLowerCase()) {
      case 'market': return { icon: '📈', color: 'text-amber-600 bg-amber-50 border-amber-200' };
      case 'risk': return { icon: '⚠️', color: 'text-red-600 bg-red-50 border-red-200' };
      case 'crop': return { icon: '🌱', color: 'text-green-600 bg-green-50 border-green-200' };
      case 'critic': return { icon: '🔍', color: 'text-purple-600 bg-purple-50 border-purple-200' };
      default: return { icon: '🤖', color: 'text-gray-600 bg-gray-50 border-gray-200' };
    }
  };

  return (
    <div className="bg-white border border-gray-100 rounded-3xl p-6 sm:p-8 shadow-sm mt-4" ref={containerRef}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
           <span className="text-blue-600">🧠</span> Процес на Дебат
        </h3>
        
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition text-sm font-medium"
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          {isPlaying ? 'Пауза' : 'Пусни'}
        </button>
      </div>

      {/* Progress Bar за рундове (ако имаме повече рундове) */}
      {maxRounds > 1 && (
        <div className="mb-8">
          <div className="flex justify-between text-xs text-gray-500 mb-1 font-medium">
            <span>Рунд {currentRound} от {maxRounds}</span>
            <span>{Math.round(progress)}% завършено</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Анимация на агентите */}
      <div className="space-y-6">
        {debateHistory.map((item, index) => {
          const { icon, color } = getAgentIconAndColor(item.agent);
          return (
            <div 
              key={index}
              ref={el => { itemRefs.current[index] = el; }}
              className={`p-5 rounded-2xl border transition-all duration-700 shadow-sm ${
                step > index 
                  ? 'opacity-100 translate-y-0 border-gray-200 bg-white' 
                  : 'opacity-40 translate-y-4 bg-gray-50 border-gray-100'
              }`}
            >
              <div className="flex gap-4 items-start">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 transition-colors duration-500 border
                  ${step > index ? color : 'bg-gray-100 border-gray-200 text-gray-400'}`}>
                  {icon}
                </div>
                
                <div className="flex-1">
                  <p className="font-bold text-gray-800 flex items-center gap-2">
                     {item.agent} Agent 
                     {step === index && <span className="flex h-2 w-2 relative ml-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span></span>}
                  </p>
                  <p className={`text-[15.5px] leading-relaxed mt-1.5 transition-all duration-500 whitespace-pre-wrap
                    ${step > index ? 'text-gray-700' : 'text-gray-400'}`}>
                    {step > index ? item.content : "Обмисля позицията си..."}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Финален Отговор */}
      <div ref={el => { itemRefs.current[debateHistory.length] = el; }} className={`mt-10 transition-all duration-1000 ${showFinal ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
        {finalAnswer && (
          <div className="p-7 bg-gradient-to-br from-green-50 to-emerald-50 border border-emerald-200 rounded-3xl shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="text-3xl">🎯</div>
              <div className="flex-1">
                <p className="font-bold text-emerald-800 text-lg">Финална Препоръка</p>
                <p className="text-sm text-emerald-600 font-medium">Синтезирана от Orchestrator</p>
              </div>
              {consensusLevel && (
                 <span className={`px-4 py-1.5 text-sm rounded-full font-bold shadow-sm
                    ${consensusLevel === 'high' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                    {consensusLevel === 'high' ? 'Високо съгласие' : 'Средно съгласие'}
                  </span>
              )}
            </div>
            <div className="prose prose-green max-w-none text-[16px] leading-relaxed text-gray-800">
              {finalAnswer.split('\n').map((line, i) => (
                <p key={i} className="mb-2">{line}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
