import { useEffect, useState } from 'react';
import { ref, push, serverTimestamp, set } from 'firebase/database';
import { db, subscribeToChat } from '../../firebase/db';
import { useGameStore } from '../../game/store';
import type { ChatMessage } from '../../types/chat';

export interface UseChatMessagesResult {
  messages: Array<ChatMessage & { id: string }>;
  send: (text: string) => Promise<void>;
}

/**
 * Kanonisk kanal-id for privat samtale: alfabetisk sortert "a__b".
 */
export function privateChannelId(a: string, b: string): string {
  if (a === b) throw new Error('privateChannelId krever to forskjellige slotIds');
  return a < b ? `${a}__${b}` : `${b}__${a}`;
}

export function useChatMessages(channelId: string): UseChatMessagesResult {
  const gameId = useGameStore(s => s.gameId);
  const slotId = useGameStore(s => s.slotId);
  const [messages, setMessages] = useState<Array<ChatMessage & { id: string }>>([]);

  useEffect(() => {
    if (!gameId || !channelId) return;
    return subscribeToChat(gameId, channelId, raw => {
      const arr = Object.entries(raw ?? {})
        .map(([id, m]) => ({ id, ...m }))
        .sort((a, b) => a.sentAt - b.sentAt);
      setMessages(arr);
    });
  }, [gameId, channelId]);

  async function send(text: string): Promise<void> {
    if (!gameId || !slotId) throw new Error('Ikke pålogget');
    const trimmed = text.trim();
    if (trimmed.length === 0 || trimmed.length > 500) {
      throw new Error('Melding må være 1–500 tegn');
    }
    const channelRef = ref(db, `games/${gameId}/chat/${channelId}`);
    const newRef = push(channelRef);
    await set(newRef, {
      authorSlotId: slotId,
      text: trimmed,
      sentAt: serverTimestamp(),
    });
  }

  return { messages, send };
}
