import React, { useState, useRef, useEffect } from "react";
import { useChatStore } from "../../store/chatStore";
import { useChatStream } from "../../hooks/useChatStream";
import { MarkdownBlock } from "./MarkdownBlock";
import { useVirtualizer } from "@tanstack/react-virtual";
import { type Attachment } from "../../types/chat";
import { parseDocumentToText } from "../../utils/documentParser";
import { compressImageToBase64 } from "../../utils/imageCompressor";

export const ChatArea: React.FC = () => {
  const { conversations, activeId } = useChatStore();
  const { sendMessage, stopGenerating, isGenerating } = useChatStream();
  const [input, setInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeConv = conversations.find((c) => c.id === activeId);
  const messages = activeConv?.messages || [];

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // 预估每条消息高度，提升滚动平滑度
    overscan: 5, // 上下多渲染 5 条，防止快速滚动白屏
  });

  // 流式输出时，或者有新消息时，自动滚动到底部
  useEffect(() => {
    if (messages.length > 0) {
      rowVirtualizer.scrollToIndex(messages.length - 1, { align: "end" });
    }
  }, [messages.length, messages[messages.length - 1]?.content, rowVirtualizer]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isImage = file.type.startsWith("image/");

      if (isImage) {
        try {
          // 核心亮点：触发端侧 Canvas 无损级极速压缩，体积立减 90%
          const compressedBase64 = await compressImageToBase64(file);

          const newAttachment: Attachment = {
            id: Math.random().toString(36).substring(2, 11),
            type: "image",
            name: file.name,
            data: compressedBase64,
            size: file.size, // 这里保留了原体积用于展示，但实际上传出去的是被大幅压小的字节串
          };
          setAttachments((prev) => [...prev, newAttachment]);
        } catch (error: any) {
          alert(`图片压缩处理失败: ${file.name}\n${error.message}`);
        }
      } else {
        // Document Parsing natively in Edge/Browser!
        try {
          // 显示一点用户反馈（实际生产环境建议用 toast）
          const parsedText = await parseDocumentToText(file);
          const newAttachment: Attachment = {
            id: Math.random().toString(36).substring(2, 11),
            type: "document",
            name: file.name,
            data: parsedText,
            size: file.size,
          };
          setAttachments((prev) => [...prev, newAttachment]);
        } catch (error: any) {
          alert(`解析失败: ${file.name}\n${error.message}`);
        }
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSend = async () => {
    if (
      (!input.trim() && attachments.length === 0) ||
      !activeId ||
      isGenerating
    )
      return;
    const text = input.trim();
    const currentAttachments = [...attachments];
    setInput("");
    setAttachments([]);
    await sendMessage(activeId, text, currentAttachments);
  };

  if (!activeConv) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-950 text-gray-400">
        <div className="text-center">
          <div className="text-4xl mb-4">🤖</div>
          <p>Select a conversation or start a new one to begin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-950 relative h-full">
      {/* Header */}
      <header className="h-14 shrink-0 border-b border-gray-200 dark:border-gray-800 flex items-center px-6 justify-between">
        <h2 className="font-semibold text-gray-800 dark:text-gray-200">
          {activeConv.title}
        </h2>
      </header>

      {/* Message List - Virtual Scrolling 虚拟长列表优化 */}
      <div ref={parentRef} className="flex-1 overflow-y-auto p-4 pb-32">
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const msg = messages[virtualRow.index];
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement} // 动态测量 Markdown 实际高度
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                  paddingBottom: "24px", // 替代原先的 space-y-6
                }}
              >
                <div
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} group`}
                >
                  <div
                    className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"} max-w-[80%]`}
                  >
                    <div
                      className={`rounded-2xl p-4 w-full ${
                        msg.role === "user"
                          ? "bg-blue-600 text-white rounded-br-none"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-none shadow-sm"
                      }`}
                    >
                      {/* Render Attachments */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {msg.attachments.map((att) =>
                            att.type === "image" ? (
                              <img
                                key={att.id}
                                src={att.data}
                                alt="attachment"
                                className="max-w-xs max-h-60 object-contain rounded-lg border border-black/10 dark:border-white/10"
                              />
                            ) : (
                              <div
                                key={att.id}
                                className="p-2 bg-black/10 dark:bg-white/10 rounded text-sm text-inherit flex items-center gap-1"
                              >
                                📎 <span>{att.name}</span>{" "}
                                <span className="text-[10px] opacity-70">
                                  {(att.size ? att.size / 1024 : 0).toFixed(0)}
                                  KB
                                </span>
                              </div>
                            ),
                          )}
                        </div>
                      )}

                      {msg.role === "user" ? (
                        <div className="whitespace-pre-wrap leading-relaxed">
                          {msg.content}
                        </div>
                      ) : msg.content ? (
                        <MarkdownBlock content={msg.content} />
                      ) : (
                        <span className="animate-pulse text-gray-500">
                          Thinking...
                        </span>
                      )}
                    </div>
                    {/* 用户消息的快捷操作栏 */}
                    {msg.role === "user" && (
                      <div className="flex gap-3 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-400 dark:text-gray-500 px-1">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(msg.content);
                            setCopiedId(msg.id);
                            setTimeout(() => setCopiedId(null), 2000);
                          }}
                          className="hover:text-blue-500 dark:hover:text-blue-400 transition-colors flex items-center gap-1"
                        >
                          {copiedId === msg.id ? "已复制 ✓" : "📋 复制"}
                        </button>
                        <button
                          onClick={() => setInput(msg.content)}
                          className="hover:text-blue-500 dark:hover:text-blue-400 transition-colors flex items-center gap-1"
                        >
                          ✎ 修改重发
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Input Area */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-transparent dark:from-gray-950 dark:via-gray-950 pt-10 pointer-events-none">
        <div className="max-w-4xl mx-auto flex flex-col gap-2 relative shadow-lg rounded-xl bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 text-gray-900 dark:text-gray-100 pointer-events-auto">
          {/* Attachments Preview */}
          {attachments.length > 0 && (
            <div className="flex gap-2 flex-wrap px-2 pt-2">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="relative group w-16 h-16 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800 flex items-center justify-center"
                >
                  {att.type === "image" ? (
                    <img
                      src={att.data}
                      alt={att.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px] items-center flex text-center break-all p-1 leading-tight">
                      {att.name.slice(0, 10)}...
                    </span>
                  )}
                  <button
                    onClick={() => removeAttachment(att.id)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px]"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 relative w-full">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              multiple
              accept="image/*,.pdf,.docx,.txt"
              onChange={handleFileChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-3 mb-1 text-gray-500 hover:text-blue-500 transition-colors"
              title="Upload file or image"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type your prompt here... (Press Enter to send)"
              className="flex-1 resize-none overflow-hidden bg-transparent pt-3 pb-3 outline-none"
              rows={1}
              style={{ minHeight: "48px", maxHeight: "200px" }}
            />
            {isGenerating ? (
              <button
                onClick={stopGenerating}
                className="mb-1 mr-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors cursor-pointer"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim() && attachments.length === 0}
                className="mb-1 mr-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors cursor-pointer"
              >
                Send
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
