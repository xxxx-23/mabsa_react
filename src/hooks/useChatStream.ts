import { useRef, useCallback, useState } from 'react';
import { useChatStore } from '../store/chatStore';
import { fetchLLMStream } from '../api/llm';
import { createMockChatStream } from '../api/mockStreaming';

import { type Attachment } from '../types/chat';

export const useChatStream = () => {
  const { addMessage, updateMessageStream, settings } = useChatStore();
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const sendMessage = useCallback(async (conversationId: string, text: string, attachments?: Attachment[]) => {
    if ((!text.trim() && (!attachments || attachments.length === 0)) || isGenerating) return;
    
    // 1. 本地立即将用户发的话上屏
    addMessage(conversationId, { role: 'user', content: text, attachments });
    // 2. 也是在本地立即新增一个空的 AI 消息盒子
    const assistantMsgId = addMessage(conversationId, { role: 'assistant', content: '' });

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsGenerating(true);

try {
      // 获取当前聊天上下文 (这里改为 slice(0, -2)，把刚才入库的用户真实提问和 AI 占位框都剔除掉)
      const currentConv = useChatStore.getState().conversations.find(c => c.id === conversationId);
      const history = currentConv ? currentConv.messages.slice(0, -2) : [];
      
      // 🚀 核心优化：上下文滑动窗口（消除 Token 爆炸）
      // 保留最新的 N 条消息 (注意这里改成了 let，因为后面可能需要再次裁剪)
      const maxHistory = settings.maxHistoryLength || 10;
      let trimmedHistory = history.slice(-maxHistory);

      // 👇 【新增的核心防御逻辑】：确保截断后的历史记录绝对不能以 assistant 开头
      if (trimmedHistory.length > 0 && trimmedHistory[0].role === 'assistant') {
        trimmedHistory = trimmedHistory.slice(1);
      }
      
      // 构建发送给大模型的 payload，强行插入 System Prompt
      const payloadMessages = [];
      if (settings.systemPrompt) {
        payloadMessages.push({ role: 'system', content: settings.systemPrompt });
      }
      
      // 拼装：系统提示词 + 裁剪后的历史记录 + 当前用户的最新的一句话
      const finalMessages = [
        ...payloadMessages,
        ...trimmedHistory.map(m => ({ role: m.role, content: m.content, attachments: m.attachments })),
        { role: 'user', content: text, attachments: attachments }
      ];

      let reader: ReadableStreamDefaultReader<Uint8Array>;

      // 为了容错：没有填 API Key，默认用咱们自己手写的假数据
      if (!settings.apiKey) {
        console.warn('⚠️ 你还没有配置 API Key，现在会使用咱们准备的模拟假数据。');
        const stream = createMockChatStream(text, controller.signal);
        reader = stream.getReader();
      } else {
        // 调用真实的 LLM 网络请求！！！
        const stream = await fetchLLMStream(finalMessages, settings, controller.signal);
        reader = stream.getReader();
      }

      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        if (!settings.apiKey) {
          // 模拟流直接塞字符串就行
          updateMessageStream(conversationId, assistantMsgId, buffer);
          buffer = '';
        } else {
          // 真正的 SSE 协议解析核心：
          // TCP 网络包不稳定，可能一半切片了，必须以双换行符界定！
          const lines = buffer.split(/\r?\n\r?\n/);
          buffer = lines.pop() || ''; // 最后一段留着下次拼

          for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine.startsWith('data: ')) continue;
            
            const message = cleanLine.replace(/^data: /, '');
            if (message === '[DONE]') break;
            
            if (message) {
              try {
                const parsed = JSON.parse(message);
                const chunk = parsed.choices?.[0]?.delta?.content || '';
                if (chunk) {
                  updateMessageStream(conversationId, assistantMsgId, chunk);
                }
              } catch (e) {
                console.error('SSE JSON 解析错误 (部分切片):', message, e);
              }
            }
          }
        }
      }

      // 处理流结束时可能残留的无末尾换行的 buffer（通常是服务器报错返回了普通 JSON 而非流）
      if (buffer.trim().length > 0 && settings.apiKey) {
         try {
           const cleaned = buffer.replace(/^data: /, '').trim();
           if (cleaned === '[DONE]') return;
           const parsed = JSON.parse(cleaned);
           if (parsed.error || (parsed.header && parsed.header.code !== 0)) {
              updateMessageStream(conversationId, assistantMsgId, `\\n\\n**😔 服务器返回异常**: \\n\`\`\`json\\n${JSON.stringify(parsed, null, 2)}\\n\`\`\``);
           }
         } catch {
           updateMessageStream(conversationId, assistantMsgId, `\\n\\n**未知的残留数据**: ${buffer}`);
         }
      }

    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.error('Stream error:', e);
        updateMessageStream(conversationId, assistantMsgId, `\n\n**😔 请求失败**: ${e.message}`);
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }, [addMessage, updateMessageStream, isGenerating, settings]);

  const stopGenerating = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsGenerating(false);
    }
  }, []);

  return { sendMessage, stopGenerating, isGenerating };
};
