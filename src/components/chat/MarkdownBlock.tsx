import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
// highlight.js styles need to be installed, assuming github-dark for a sleek preset
import 'highlight.js/styles/github-dark.css';

interface Props {
  content: string;
}

export const MarkdownBlock: React.FC<Props> = ({ content }) => {
  return (
    <div className="markdown-body text-sm leading-relaxed overflow-hidden">
      <ReactMarkdown 
        rehypePlugins={[rehypeHighlight]}
        components={{
          ul: ({ node, ...props }: any) => <ul className="list-disc pl-5 my-2" {...props} />,
          ol: ({ node, ...props }: any) => <ol className="list-decimal pl-5 my-2" {...props} />,
          li: ({ node, ...props }: any) => <li className="my-1" {...props} />,
          p: ({ node, ...props }: any) => <p className="mb-4 last:mb-0" {...props} />,
          h1: ({ node, ...props }: any) => <h1 className="text-2xl font-bold my-4" {...props} />,
          h2: ({ node, ...props }: any) => <h2 className="text-xl font-bold my-3" {...props} />,
          h3: ({ node, ...props }: any) => <h3 className="text-lg font-bold my-2" {...props} />,
          pre({ node, children, ...props }: any) {
            return (
              <div className="overflow-hidden rounded-xl bg-gray-900 border border-gray-800 my-4 shadow-sm">
                <div className="flex items-center justify-between px-4 py-2 bg-gray-800 text-xs text-gray-400">
                  <span className="font-mono">Code snippet</span>
                  <button className="hover:text-white transition-colors" onClick={() => {
                    const code = getCodeString(children);
                    navigator.clipboard.writeText(code);
                  }}>Copy Code</button>
                </div>
                <pre className="p-4 overflow-x-auto text-sm text-gray-50" {...props}>
                  {children}
                </pre>
              </div>
            );
          },
          code({ node, className, children, ...props }: any) {
            // Note: inline code uses a distinct background for visibility
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match;
            return !isInline ? (
              <code className={className} {...props}>
                {children}
              </code>
            ) : (
              <code className="px-1.5 py-0.5 rounded-md bg-gray-200 dark:bg-gray-800 text-blue-600 dark:text-blue-400 font-mono text-sm" {...props}>
                {children}
              </code>
            );
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

// Helper to extract plain text from React children for the copy button
const getCodeString = (children: React.ReactNode): string => {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(getCodeString).join('');
  if (typeof children === 'object' && children !== null && 'props' in children) {
    return getCodeString((children as any).props.children);
  }
  return '';
};
