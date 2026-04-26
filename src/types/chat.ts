export interface ChatMessage {
  authorSlotId: string;
  text: string;
  sentAt: number;
}

export type ChatChannelId = 'global' | string; // global eller "slotA__slotB" der slotA < slotB
