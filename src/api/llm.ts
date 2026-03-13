import { type Attachment } from '../types/chat';

export interface APISettings {
  apiKey: string;
  baseUrl: string;
  model: string;
  systemPrompt?: string;
  maxHistoryLength?: number;
}

/**
 * 核心考点：纯原生 Fetch 配合 ReadableStream 解析 Server-Sent Events (SSE)
 * 为什么不用官方 openai-node SDK？因为它太重了，手写 SSE 解析能极大展示你的原生 JS 网络功底！
 */
export const fetchLLMStream = async (
  messages: { role: string; content: string; attachments?: Attachment[] }[], // Context with attachments

  settings: APISettings,
  signal: AbortSignal
): Promise<ReadableStream<Uint8Array>> => {
  const { apiKey, baseUrl, model } = settings;

  // 如果用户配了 URL 末尾多斜杠，处理一下
  const cleanBaseUrl = baseUrl.replace(/\/$/, "");

  // 1. 把我们的本地数据格式，转换成 OpenAI API 需要的格式
  const apiMessages = messages.map(m => {
    if (m.attachments && m.attachments.length > 0) {
      const contentArray: any[] = [{ type: 'text', text: m.content || ' ' }]; // Vision API usually requires at least an empty space
      m.attachments.forEach(att => {
        if (att.type === 'image') {
          contentArray.push({
            type: 'image_url',
            image_url: { url: att.data }
          });
        } else if (att.type === 'document') {
          // Temporarily append document data as text 
          contentArray[0].text += `\n\n[Document: ${att.name}]\n${att.data}`;
        }
      });
      return { role: m.role, content: contentArray };
    }

    return { role: m.role, content: m.content };
  });

  // 2. 发起真实的 Fetch 请求，告诉服务器我们要 stream: true
  // 适配兼容各种大模型平台（如 DeepSeek, 通义千问, 智谱等），只要他们兼容 OpenAI 格式
  const response = await fetch(`${cleanBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    signal, // 传入 AbortSignal，按停止键时会原生地切断 TCP 连接
    body: JSON.stringify({
      model: model || 'gpt-3.5-turbo',
      messages: apiMessages,
      stream: true, // 核心：开启流式返回
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API 请求失败: HTTP ${response.status} - ${errorText}`);
  }

  // 3. 原生截获服务器甩过来的数据流
  if (!response.body) throw new Error("服务器没有返回数据流");
  return response.body;
};
