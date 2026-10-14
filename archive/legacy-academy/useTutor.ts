import { useState, useCallback } from 'react';

export function useTutor(userId: string) {
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [threadId] = useState(`chat_${userId}`);

  const sendMessage = useCallback(async (question: string, mode = "general") => {
    setIsLoading(true);
    
    try {
      const res = await fetch('/api/tutor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          userId,
          threadId,
          mode
        })
      });

      const data = await res.json();
      
      setMessages(prev => [
        ...prev,
        { role: 'user', content: question },
        { role: 'assistant', content: data.answer, sources: data.sources }
      ]);
      
      setIsLoading(false);
      return data;
    } catch (error) {
      console.error("Error sending message to tutor:", error);
      setIsLoading(false);
      return null;
    }
  }, [userId, threadId]);

  return { messages, sendMessage, isLoading, threadId };
}
