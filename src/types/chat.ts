export interface Attachment {
  id: string;
  type: 'image' | 'document';
  name: string;
  data: string; // Base64 或是文本
  size?: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: Attachment[];
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}
