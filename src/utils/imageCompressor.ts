/**
 * 极简的前端 Canvas 图片极速压缩器
 * 核心考点：充分利用现代浏览器的客户端硬件算力，把动辄几 MB 级别的高清大图，
 * 在转为 Base64 之前，静默压缩并在内存中重绘为几十到数百 KB 的 JPEG 格式。
 * 这极大降低了大模型流式网关（如 Nginx/WAF）拦截超大 Request Body 的风险，防止 fetch 卡死。
 */
export const compressImageToBase64 = (file: File, maxWidth = 1024, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    // 第一步：先将 File 读入内存为初步的 DataURL
    reader.onload = (event) => {
      const img = new Image();
      
      // 第二步：由于 JS 加载图片是异步的，监听它的装载完成事件
      img.onload = () => {
        // 计算等比缩放的尺寸
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        // 第三步：创建隐藏的 DOM Canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("浏览器不支持 Canvas 上下文"));
          return;
        }

        // 第四步：触发 GPU/CPU 重绘画布（这一步完成了实质的像素抽取）
        ctx.fillStyle = "#FFFFFF"; // 避免 PNG 透明部分变黑
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // 第五步：导出为低质量、有损但体积暴降的 JPEG Base64 字符串
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };
      
      img.onerror = (error) => reject(error);
      
      if (event.target?.result) {
        img.src = event.target.result as string;
      } else {
        reject(new Error("文件读取失败"));
      }
    };
    
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};
