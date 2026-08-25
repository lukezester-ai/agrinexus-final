'use client';

import { Bot, CheckCircle } from 'lucide-react';

interface DebateMessage {
  agent: string;
  content: string;
  round?: number;
}

interface DebateVisualizationProps {
  debateHistory: DebateMessage[];
  finalAnswer: string;
  consensusLevel: string;
}

export default function DebateVisualization({ 
  debateHistory, 
  finalAnswer, 
  consensusLevel 
}: DebateVisualizationProps) {
  
  const getAgentColor = (agent: string) => {
    switch(agent.toLowerCase()) {
      case 'market': return 'bg-amber-100 border-amber-500';
      case 'risk': return 'bg-red-100 border-red-500';
      case 'crop': return 'bg-green-100 border-green-500';
      case 'critic': return 'bg-purple-100 border-purple-500';
      default: return 'bg-gray-100';
    }
  };

  const getAgentIcon = (agent: string) => {
    switch(agent.toLowerCase()) {
      case 'market': return '📈';
      case 'risk': return '⚠️';
      case 'crop': return '🌱';
      case 'critic': return '🔍';
      default: return '🤖';
    }
  };

  return (
    <div className="space-y-8 mt-6">
      {/* Debate Flow */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold mb-5 flex items-center gap-2 text-gray-800">
          <Bot className="text-blue-600" /> Как взехме това решение (Дебат между агенти)
        </h3>
        
        <div className="space-y-6">
          {debateHistory.map((msg, index) => (
            <div key={index} className={`p-5 rounded-2xl border-l-4 shadow-sm ${getAgentColor(msg.agent)} bg-opacity-30`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="text-2xl">{getAgentIcon(msg.agent)}</div>
                <div>
                  <p className="font-semibold text-gray-800">{msg.agent} Agent</p>
                  {msg.round && <p className="text-xs text-gray-500">Рунд {msg.round}</p>}
                </div>
              </div>
              <p className="text-gray-700 whitespace-pre-wrap text-[15px] leading-relaxed">
                {msg.content || 'Няма предоставено мнение.'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Финален Отговор */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-emerald-200 rounded-3xl p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle className="text-emerald-600" size={28} />
          <h3 className="text-xl font-bold text-gray-800">Финална Препоръка от Orchestrator</h3>
          <span className={`ml-auto px-4 py-1.5 text-sm rounded-full font-semibold shadow-sm
            ${consensusLevel === 'high' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
            {consensusLevel === 'high' ? 'Високо съгласие' : 'Средно съгласие'}
          </span>
        </div>
        
        <div className="prose prose-green max-w-none text-[16px] leading-relaxed text-gray-800">
          {finalAnswer.split('\n').map((line, i) => (
            <p key={i} className="mb-2">{line}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
