/**
 * 这个文件主要用来模拟后端的“流式返回”（就像 ChatGPT 那样一个字一个字蹦出来）。
 * 在真实的大厂项目中，这里通常会使用 Fetch API 从真实的服务器读取 stream。
 */
export const createMockChatStream = (prompt: string, signal?: AbortSignal): ReadableStream<Uint8Array> => {
  // TextEncoder 用于把普通字符串转换成底层的二进制数据流 (Uint8Array)
  const textEncoder = new TextEncoder();
  
  // 模拟一段 AI 返回的假数据
  const responseText = `Here is a simulated streaming response for: "${prompt}".\n\nI am simulating a stream that sends data chunk by chunk, much like the actual API does when \`stream: true\` is enabled. I also support being aborted midway through using an \`AbortController\`.\n\n### Code Example\n\`\`\`javascript\nfunction sayHello() {\n  console.log("Hello, Stream!");\n}\n\`\`\`\n\nHope this helps!`;
  
  // 利用正则表达式，把段落按照空格或者标点符号拆分成一个个“词”或“词组”
  const chunks = responseText.split(/(?=\\s)|(?<=\\s)|(?=[.,!?;])/); 
  
  // 创建并返回一个可读流 (ReadableStream)
  return new ReadableStream({
    async start(controller) {
      // 循环遍历切好的所有的词
      for (let i = 0; i < chunks.length; i++) {
        // 【核心考点】：检查用户是否点击了“停止生成”
        // 如果外部发送了中止信号，我们就安全地关闭这个流并退出
        if (signal?.aborted) {
          controller.close();
          return;
        }

        // 模拟网络延迟和文字打字的效果 (随机延迟 10ms ~ 60ms)
        const delay = Math.floor(Math.random() * 50) + 10;
        await new Promise((resolve) => setTimeout(resolve, delay));
        
        // 将这个词装入流中，推送给前端展示
        controller.enqueue(textEncoder.encode(chunks[i]));
      }
      // 全部词都发送完毕，告诉前端流结束了
      controller.close();
    },
    cancel() {
      // 当外部强行取消流时会走到这里
      console.log('Stream was cancelled.');
    }
  });
};
