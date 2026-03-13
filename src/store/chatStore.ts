import { create } from 'zustand';
import { type Conversation,type Message } from '../types/chat';
import { db } from './db';
import { type APISettings } from '../api/llm';

const DEFAULT_SETTINGS: APISettings = {
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-3.5-turbo',
  systemPrompt: '你是 AI Workflow Space 的专属智能助理，由开发者精心打造。请用专业、友善、简洁的语言解答问题。',
  maxHistoryLength: 10,
};

interface ChatState {
  conversations: Conversation[];
  activeId: string | null;
  isInitialized: boolean;
  settings: APISettings;

  init: () => Promise<void>;
  setSettings: (settings: Partial<APISettings>) => void;
  createConversation: () => void;
  setActiveConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  addMessage: (conversationId: string, message: Omit<Message, 'id' | 'createdAt'>) => string;
  updateMessageStream: (conversationId: string, messageId: string, chunk: string) => void;
  deleteConversation: (id: string) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

const debounceSave = (() => {
  let timer: any;
  return (conv: Conversation) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      db.conversations.put(conv).catch(console.error);
    }, 500);
  };
})();

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeId: null,
  isInitialized: false,
  settings: { ...DEFAULT_SETTINGS },

  init: async () => {
    try {
      const allConvs = await db.conversations.orderBy('updatedAt').reverse().toArray();
      // Load settings from localStorage
      const savedSettings = localStorage.getItem('chat_settings');
      let initSettings = DEFAULT_SETTINGS;
      if (savedSettings) {
        initSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };
      }

      set({
        conversations: allConvs,
        activeId: allConvs.length > 0 ? allConvs[0].id : null,
        settings: initSettings,
        isInitialized: true
      });
    } catch (e) {
      console.error('Failed to load DB:', e);
      set({ isInitialized: true });
    }
  },

  setSettings: (newSettings) => {
    set((state) => {
      const merged = { ...state.settings, ...newSettings };
      localStorage.setItem('chat_settings', JSON.stringify(merged));
      return { settings: merged };
    });
  },

  createConversation: () => {
    const newConv: Conversation = {
      id: generateId(),
      title: '新建对话',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    db.conversations.put(newConv).catch(console.error);
    set((state) => ({
      conversations: [newConv, ...state.conversations],
      activeId: newConv.id,
    }));
  },

  setActiveConversation: (id) => {
    set({ activeId: id });
  },

  renameConversation: (id, title) => {
    set((state) => {
      const newConversations = state.conversations.map(conv => {
        if (conv.id === id) {
          const updatedConv = { ...conv, title, updatedAt: Date.now() };
          db.conversations.put(updatedConv).catch(console.error);
          return updatedConv;
        }
        return conv;
      });
      return { conversations: newConversations };
    });
  },

  addMessage: (conversationId, message) => {
    const msgId = generateId();
    set((state) => {
      const msg: Message = { ...message, id: msgId, createdAt: Date.now() };
      const newConversations = state.conversations.map((conv) => {
        if (conv.id === conversationId) {
          let newTitle = conv.title;
          if (conv.messages.length === 0 && message.role === 'user') {
            newTitle = message.content.slice(0, 20) + (message.content.length > 20 ? '...' : '');
          }
          const updatedConv = {
            ...conv,
            title: newTitle,
            messages: [...conv.messages, msg],
            updatedAt: Date.now(),
          };
          db.conversations.put(updatedConv).catch(console.error);
          return updatedConv;
        }
        return conv;
      });
      newConversations.sort((a, b) => b.updatedAt - a.updatedAt);
      return { conversations: newConversations };
    });
    return msgId;
  },

  updateMessageStream: (conversationId, messageId, chunk) => {
    set((state) => {
      const newConversations = state.conversations.map((conv) => {
        if (conv.id === conversationId) {
          const newMessages = conv.messages.map((msg) => {
            if (msg.id === messageId) return { ...msg, content: msg.content + chunk };
            return msg;
          });
          const updatedConv = { ...conv, messages: newMessages, updatedAt: Date.now() };
          debounceSave(updatedConv);
          return updatedConv;
        }
        return conv;
      });
      return { conversations: newConversations };
    });
  },

  deleteConversation: (id) => {
    db.conversations.delete(id).catch(console.error);
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
      activeId: state.activeId === id ? null : state.activeId,
    }));
  },
}));
