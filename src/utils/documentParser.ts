import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerURL from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';

// 使用 Vite 内置的 URL 导入机制，完美解决 worker 路径跨域或 404 问题
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerURL;

export const parseDocumentToText = async (file: File): Promise<string> => {
  const extension = file.name.split('.').pop()?.toLowerCase();

  try {
    // 1. 纯文本文档
    if (extension === 'txt' || extension === 'md' || extension === 'csv' || extension === 'json') {
      return await file.text();
    }

    // 2. PDF 文档
    if (extension === 'pdf') {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += `\n--- Page ${i} ---\n${pageText}`;
      }
      return fullText;
    }

    // 3. Word 文档 (docx)
    if (extension === 'docx') {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    }

    throw new Error(`暂不支持该文件格式解析: ${extension}`);
  } catch (error: any) {
    console.error('Document parsing error:', error);
    throw new Error(`文档提取失败: ${error.message || String(error)}`);
  }
};
