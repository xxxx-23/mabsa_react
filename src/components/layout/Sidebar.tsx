import React, { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../../store/chatStore';

export const Sidebar: React.FC = () => {
  const { conversations, activeId, createConversation, setActiveConversation, deleteConversation, settings, setSettings, renameConversation } = useChatStore();
  const [showSettings, setShowSettings] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingId]);

  const startRename = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(id);
    setEditTitle(currentTitle);
  };

  const submitRename = (id: string) => {
    if (editTitle.trim() && editTitle.trim() !== conversations.find(c => c.id === id)?.title) {
      renameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="w-64 h-full bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col relative shrink-0">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={createConversation}
          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium shadow-sm"
        >
          <span>＋ 新建对话</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {conversations.map((conv) => (
          <div
            key={conv.id}
            onClick={() => {
              if (editingId !== conv.id) setActiveConversation(conv.id);
            }}
            className={`p-3 rounded-lg cursor-pointer group flex items-center justify-between transition-colors ${
              activeId === conv.id
                ? 'bg-blue-100/50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-100 font-medium'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800/50 text-gray-700 dark:text-gray-300'
            }`}
          >
            {editingId === conv.id ? (
              <input
                ref={editInputRef}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={() => submitRename(conv.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitRename(conv.id);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                className="flex-1 max-w-[150px] text-sm bg-white dark:bg-gray-800 border-b border-blue-500 px-1 outline-none text-gray-900 dark:text-gray-100 mr-2"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div className="truncate flex-1 text-sm">
                {conv.title}
              </div>
            )}
            
            {editingId !== conv.id && (
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                <button
                  onClick={(e) => startRename(conv.id, conv.title, e)}
                  className="p-1 hover:text-blue-500 transition-colors"
                  title="重命名"
                >
                  ✎
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conv.id);
                  }}
                  className="p-1 hover:text-red-500 transition-colors"
                  title="删除对话"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        ))}
        {conversations.length === 0 && (
          <div className="text-center text-sm text-gray-400 mt-10">
            暂无历史对话
          </div>
        )}
      </div>

      {/* 底部设置按钮 */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="w-full py-2 px-4 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg transition-colors flex items-center justify-center font-medium text-sm"
        >
           ⚙️ 接口配置 (API Settings)
        </button>
      </div>

      {/* 设置面板弹窗 */}
      {showSettings && (
        <div className="absolute bottom-[76px] left-4 right-4 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 max-h-[80vh] overflow-y-auto flex flex-col">
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">大模型 API 配置</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">API Key (例如用DeepSeek)</label>
              <input
                type="password"
                value={settings.apiKey}
                onChange={(e) => setSettings({ apiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-200"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Base URL (兼容各种接口)</label>
              <input
                type="text"
                value={settings.baseUrl}
                onChange={(e) => setSettings({ baseUrl: e.target.value })}
                placeholder="https://api.openai.com/v1"
                className="w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-200"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">模型名称 (Model)</label>
              <input
                type="text"
                value={settings.model}
                onChange={(e) => setSettings({ model: e.target.value })}
                placeholder="gpt-3.5-turbo"
                className="w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-200"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">系统设定 (System Prompt)</label>
              <textarea
                value={settings.systemPrompt}
                onChange={(e) => setSettings({ systemPrompt: e.target.value })}
                placeholder="你是 AI 助手..."
                className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-200 resize-none h-16"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">携带记忆条数 (防 Token 爆炸)</label>
              <input
                type="number"
                min="1"
                max="100"
                value={settings.maxHistoryLength}
                onChange={(e) => setSettings({ maxHistoryLength: parseInt(e.target.value) || 10 })}
                className="w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-200"
              />
            </div>
          </div>
          <p className="text-xs text-green-600 dark:text-green-400 mt-4 flex justify-between items-center">
            <span>实时保存，防泄漏本地生效</span>
            <button onClick={() => setShowSettings(false)} className="px-3 py-1 bg-blue-100 dark:bg-blue-900 rounded text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 font-medium transition-colors">完成</button>
          </p>
        </div>
      )}
    </div>
  );
};
