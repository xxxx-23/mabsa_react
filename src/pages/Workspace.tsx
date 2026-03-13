import {
  Drawer,
  FloatButton,
  Select,
  Modal,
  Input,
  Row,
  Typography,
  Col,
  Card,
  Tag,
  Skeleton,
  Space,
  Button,
  Dropdown,
  Popconfirm,
  Upload,
  message,
} from "antd";
import type { MenuProps } from "antd";
import type { AspectTerm } from "../types";
import { useDataState } from "../store/useDataStore";
import React, { useEffect, useRef, useState } from "react";
import {
  CloseCircleFilled,
  DownloadOutlined,
  UploadOutlined,
  PlusOutlined,
  MinusCircleOutlined,
  DeleteOutlined,
  RobotOutlined,
} from "@ant-design/icons";

import { ChatArea } from "../components/chat/ChatArea";
import { Sidebar } from "../components/layout/Sidebar";
import { useChatStore } from "../store/chatStore";
import { useChatStream } from "../hooks/useChatStream";
import { type Attachment } from "../types/chat";

const { Title, Paragraph } = Typography;

const Workspace: React.FC = () => {
  // 从 Zustand 仓库里把状态和方法“提取”出来
  const {
    currentData,
    currentIndex,
    isLoading,
    currentUser,
    logout,
    updateDataStatus,
    fetchData,
    updateAspectPolarity,
    deleteYoloBox,
    addNewData,
    dataList,
    addAspect,
    addYoloBox,
    deleteAspect,
    deleteCurrentData,
    settings,
    loadAllData,
  } = useDataState();

  // 首先定义去设置方面词需要用的属性
  interface selectedWordInfo {
    visible: boolean;
    x: number;
    y: number;
    term: string;
    startIndex: number;
    endIndex: number;
  }

  // 智能副驾抽屉开关
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);

  // 从 chatStore 拿发送消息的方法，准备做跨模块联动
  // const { sendMessage } = useChatStore();

  // 1. 从 chatStore 拿到当前的活动对话 ID (activeId)
  const { activeId } = useChatStore();
  // 2. 从 useChatStream 拿到发送消息的方法
  const { sendMessage } = useChatStream();
  // 从 chatStore 拿出 init 方法
  const { init: initChatStore } = useChatStore();

  // 核心锁：如果当前数据状态是 done，且当前登录人是 annotator (标注员)，那么界面就彻底上锁！
  const isLockedForMe =
    currentData?.status === "done" && currentUser?.role === "annotator";

  // 组件刚挂载到屏幕上时，我们请求第 0 条数据
  useEffect(() => {
    loadAllData();
    initChatStore();
  }, []); // 空数组代表只在初次渲染时执行一次

  // 定义悬浮菜单的状态
  // 记录它是否显示、显示在屏幕的什么坐标、以及用户到底选了什么词
  const [selectedWord, setSelectedWord] = useState<selectedWordInfo | null>(
    null,
  );

  // 准备一个钩子，用来“勾住”那个弹出来的悬浮菜单（方面词的标记菜单） DOM
  const popupRef = useRef<HTMLDivElement>(null);

  // 为图片容器加一个钩子，用来计算绝对相对坐标
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // 定义“正在画框”的状态
  const [drawingState, setDrawingState] = useState({
    isDrawing: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
  });

  // 增加控制弹窗的状态用来记录“弹窗是否显示”、“用户刚才画的框的数据”以及“输入框里的字”：
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [tempBoxData, setTempBoxData] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [labelInput, setLabelInput] = useState("");

  // 增加一个控制 AI 请求的局部状态
  const [isPredicting, setIsPredicting] = useState(false);

  // 新增弹窗控制和表单状态
  const [isAddDataModalVisible, setIsAddDataModalVisible] = useState(false);
  const [newRawText, setNewRawText] = useState("");
  // const [newAspectsInput, setNewAspectsInput] = useState("");
  const [manualAspects, setManualAspects] = useState<
    Array<{ id: string; term: string; polarity: AspectTerm["polarity"] }>
  >([]);
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newYoloFile, setNewYoloFile] = useState<File | null>(null);

  // 工具 1：把图片 File 转换成 Base64 字符串
  // const getBase64 = (file: File): Promise<string> => {
  //   return new Promise((resolve, reject) => {
  //     const reader = new FileReader();
  //     reader.readAsDataURL(file);
  //     reader.onload = () => resolve(reader.result as string);
  //     reader.onerror = (error) => reject(error);
  //   });
  // };

  // 工具 2：获取 Base64 图片的真实物理宽高（YOLO 逆运算极其需要！）
  const getImageDimensions = (
    base64Str: string,
  ): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
    });
  };

  // 工具 3：把 File 转换成纯文本
  const getTextFromFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsText(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleAddNewDataSubmit = async () => {
    if (!newRawText.trim() || !newImageFile) {
      message.error("🚨 推文文本和图片是必填项！");
      return;
    }

    const hideLoading = message.loading("正在将图片推送到服务器并入库...", 0);

    try {
      // 1. 使用 FormData 将文件实体发给后端
      const formData = new FormData();
      formData.append("file", newImageFile);

      const uploadRes = await fetch("http://localhost:8000/api/upload", {
        method: "POST",
        body: formData, // 不要设置 Content-Type,浏览器会自动处理 boundary
      });

      const uploadData = await uploadRes.json();
      if (uploadData.status !== "success") {
        throw new Error("图片推送到服务器失败！");
      }

      // 拿到后端返回的真实图片 URL
      const finalImageUrl = uploadData.url;

      // 2. 利用本地 URL 闪电获取图片分辨率
      // 我们不需要等图片从后端下载回来获取分辨率，直接在本地用 URL.createObjectURL 秒算
      const localPreivewUrl = URL.createObjectURL(newImageFile);
      const { width: imgW, height: imgH } =
        await getImageDimensions(localPreivewUrl);
      URL.revokeObjectURL(localPreivewUrl); // 算完后立刻释放内存

      // 解析手动输入的方面词
      let parsedAspects: any[] = [];

      // 3. 解析 YOLO 文件（如果存在的话）
      let parsedBboxes: any[] = [];
      if (newYoloFile) {
        const yoloText = await getTextFromFile(newYoloFile);
        const lines = yoloText.split("\n").filter((line) => line.trim() !== "");

        parsedBboxes = lines.map((line, index) => {
          // YOLO 格式： class_id x_center y_center w_norm h_norm
          const [classId, xCenter, yCenter, wNorm, hNorm] = line
            .trim()
            .split(/\s+/)
            .map(Number);
          // 逆向运算：把 0~1 的比例还原成真实像素
          const boxWidth = wNorm * imgW;
          const boxHeight = hNorm * imgH;
          const boxX = xCenter * imgW - boxWidth / 2;
          const boxY = yCenter * imgH - boxHeight / 2;

          return {
            id: `imported_box_${Date.now()}_${index}`,
            label: `class_${classId}`, // YOLO 里只有数字，先用 class_X 占位，用户后续可改
            confidence: 1.0,
            x: boxX,
            y: boxY,
            width: boxWidth,
            height: boxHeight,
          };
        });
      }

      // 过滤掉那些添加了输入框但没写字的空项
      const validManualAspects = manualAspects.filter(
        (a) => a.term.trim() !== "",
      );

      validManualAspects.forEach((item, idx) => {
        const term = item.term.trim();
        const startIndex = newRawText.indexOf(term);

        if (startIndex !== -1) {
          parsedAspects.push({
            id: `manual_aspect_${Date.now()}_${idx}`,
            term: term,
            startIndex: startIndex,
            endIndex: startIndex + term.length,
            polarity: item.polarity, // 直接使用用户在下拉框里选好的极性！
          });
        } else {
          message.warning(`⚠️ 方面词 "${term}" 未在原文中找到，已自动忽略。`);
        }
      });

      // 4. 组装最终的 MultimodalData
      const newEntry = {
        tweetId: `custom_${Date.now()}`, // 生成唯一 ID
        rawText: newRawText,
        aspects: parsedAspects,
        imageUrl: finalImageUrl,
        yoloBboxes: parsedBboxes,
      };

      // 5. 存入 Zustand 仓库
      addNewData(newEntry);

      // 6. 清理战场，关闭弹窗
      hideLoading();
      message.success("✨ 新数据录入成功！");
      setIsAddDataModalVisible(false);
      setNewRawText("");
      setManualAspects([]);
      setNewImageFile(null);
      setNewYoloFile(null);
    } catch (error) {
      hideLoading();
      message.error(`🚨 数据录入中断: ${error}`);
    }
  };

  // 核心函数： 获取鼠标相对于图片容器的精确坐标
  const getRelativeCoords = (e: React.MouseEvent) => {
    if (!imageContainerRef.current)
      return {
        x: 0,
        y: 0,
      };

    const rect = imageContainerRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left, // 鼠标屏幕 X - 容器距离屏幕左侧的距离 = 图片内相对 X
      y: e.clientY - rect.top, // 同理计算 Y
    };
  };

  // 鼠标按下：开始画！记录起点
  const handleMouseDown = (e: React.MouseEvent) => {
    // 👇 【新增】：如果是锁定状态，直接不让画
    if (isLockedForMe) {
      message.warning("🔒 该数据已审核通过，无法绘制新框！");
      return;
    }
    const { x, y } = getRelativeCoords(e);
    setDrawingState({
      isDrawing: true,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
    });
  };

  // 鼠标移动：如果正在画，实时更新当前点
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drawingState.isDrawing) return;
    const { x, y } = getRelativeCoords(e);
    setDrawingState((prev) => ({
      ...prev,
      currentX: x,
      currentY: y,
    }));
  };

  // 鼠标松开：画完了！计算最终数据并存入仓库
  const handleDrawMouseUp = () => {
    if (!drawingState.isDrawing || !currentData) return;

    const { startX, startY, currentX, currentY } = drawingState;

    // 几何魔法：计算最终的 x, y, width, height
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    const finalX = Math.min(startX, currentX);
    const finalY = Math.min(startY, currentY);

    // 防御编程：过滤掉误触（比如只是随便点了一下，没拖拽）
    if (width > 10 && height > 10) {
      // 1. 暂存刚才画的几何数据
      setTempBoxData({ x: finalX, y: finalY, width, height });

      // 2. 清空上一次输入的字，准备迎接新标签
      setLabelInput("target");

      // 3. 呼出 Ant Design 弹窗
      setIsModalVisible(true);
    }

    // 重置画图状态
    setDrawingState({
      isDrawing: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
    });
  };

  // 确认保存新的 YOLO 框
  const handleModalOk = () => {
    if (tempBoxData && labelInput.trim() && currentData) {
      const newBox = {
        id: `box_${Date.now()}`,
        label: labelInput.trim(),
        confidence: 1.0,
        ...tempBoxData,
      };

      addYoloBox(currentData.tweetId, newBox);

      // 把【自动下一条】的逻辑搬到这里！只有当用户点确定保存后，才跳转
      // 检测设置，执行自动下一条
      if (settings.autoNext) {
        if (currentIndex < dataList.length - 1) {
          message.success("画框成功！已自动为您切换下一条...");
          fetchData(currentIndex + 1);
        } else {
          message.info("这已经是最后一条数据啦！");
        }
      }
    }

    // 关掉弹窗，清空缓存
    setIsModalVisible(false);
    setTempBoxData(null);
  };

  // 取消保存新的 YOLO 框
  const handleModalCancel = () => {
    setIsModalVisible(false);
    setTempBoxData(null);
  };

  // 利用 useEffect 建立全局点击监听
  useEffect(() => {
    // 定义一个处理点击事件的函数
    const handleClickOutside = (e: MouseEvent) => {
      // 如果 popupRef 成功勾到了菜单，并且当前的鼠标点击的元素（e.target）不在菜单里面
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setSelectedWord(null); // 就进行菜单的关闭
        window.getSelection()?.removeAllRanges(); // 顺便把浏览器里被选中然后渲染为蓝色的文字清掉
      }
    };

    // 给整个文档绑定 mousedown （鼠标按下）事件
    document.addEventListener("mousedown", handleClickOutside);

    // 清理函数！离开页面时一定要把监听器拆掉，否则会导致内存泄漏
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // 监听鼠标松开事件，捕获划词
  const handleMouseUp = (e: React.MouseEvent) => {
    if (!currentData) return;

    if (isLockedForMe) {
      window.getSelection()?.removeAllRanges(); // 清除蓝色选中状态
      message.warning("🔒 该数据已审核通过，无法添加新词汇！");
      return;
    }

    const selection = window.getSelection();

    // 如果没有选中任何文字，或者只是随便点了一下（isCollapsed），就关掉菜单
    if (!selection || selection.isCollapsed) {
      setSelectedWord(null);
      return;
    }

    // 获取用户选中的纯文本，并去掉首尾空格
    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    // 为了能让我们的“切片机”识别，我们必须算出这个词在原句（rawText）中的起始和结束位置
    const startIndex = currentData.rawText.indexOf(selectedText);

    // 如果没找到，直接退出
    if (startIndex === -1) return;

    const endIndex = startIndex + selectedText.length;

    // 召唤悬浮菜单！出现在鼠标松开的位置
    setSelectedWord({
      visible: true,
      x: e.clientX,
      y: e.clientY + 10,
      term: selectedText,
      startIndex,
      endIndex,
    });
  };

  // 确认添加标注的函数
  const confirmAddAspect = (polarity: AspectTerm["polarity"]) => {
    if (!selectedWord || !currentData) return;

    // 组装一颗全新的 Aspect 子弹
    const newAspect: AspectTerm = {
      id: `aspect_${Date.now()}`, // 使用时间戳生成一个独一无二的 ID
      term: selectedWord.term,
      startIndex: selectedWord.startIndex,
      endIndex: selectedWord.endIndex,
      polarity,
    };

    // 把它存入仓库
    addAspect(currentData.tweetId, newAspect);

    // 清理战场：关掉菜单，取消文字的系统选中高亮
    setSelectedWord(null);
    window.getSelection()?.removeAllRanges();

    // 检测设置，执行自动下一条
    if (settings.autoNext) {
      // 必须要判断一下当前是不是最后一条，防止数组越界报错
      if (currentIndex < dataList.length - 1) {
        message.success("文本标注成功！已自动为您切换下一条...");
        fetchData(currentIndex + 1);
      } else {
        message.info("这已经是最后一条数据啦！");
      }
    }
  };

  // 高亮方面词
  const renderHighlightedText = (Text: string, aspects: AspectTerm[]) => {
    // 容错处理： 如果没有 高亮词 直接返回 原文本
    if (!aspects || aspects.length === 0) {
      return Text;
    }

    // 排序： 必须按照 startIndex 从小到大排，保证我们从左往右切
    const sortedAspects = [...aspects].sort(
      (a, b) => a.startIndex - b.startIndex,
    );

    // 用这个数组来存放切下来的 React 节点
    const resultElements: React.ReactNode[] = [];

    // 声明一个游标：记录我们当前切到原文本的哪个位置了
    let currentIndex = 0;

    // 开始遍历每一个高亮词
    sortedAspects.forEach((aspect) => {
      // 情况1：如果游标还没有走到高亮词的开头，说明中间有段 ‘普通文本’
      if (currentIndex < aspect.startIndex) {
        resultElements.push(
          <span key={`text-${currentIndex}`}>
            {Text.slice(currentIndex, aspect.startIndex)}
          </span>,
        );
      }

      // 情况2：组装 ‘高亮文本’，我们可以根据 polarity 动态改变颜色
      const bgColor =
        aspect.polarity === "positive"
          ? "#d9f7be"
          : aspect.polarity === "negative"
            ? "red"
            : "yellow";
      resultElements.push(
        <span
          key={`aspect-${aspect.id}`}
          style={{
            backgroundColor: bgColor,
            padding: "2px 4px",
            borderRadius: "4px",
            fontWeight: "bold",
            color: "#333",
          }}
        >
          {Text.slice(aspect.startIndex, aspect.endIndex)}
        </span>,
      );

      // 把游标也随着移动，移动到当前方面词的末尾
      currentIndex = aspect.endIndex;
    });

    // 如果所有高亮词的切完后，游标还没有走完，需要末尾的字段也进行渲染
    if (currentIndex < Text.length) {
      resultElements.push(
        <span key={`text-end`}>{Text.slice(currentIndex)}</span>,
      );
    }
    return resultElements;
  };

  // 导出函数：实现对真实 json 文件的导入和导出
  const handleExportJSON = () => {
    // 从数据大盘里拿到我们正在处理的完整数据列表
    // 注意：你需要去 useDataStore.ts 里把 mockDataList 存到 state 里，或者直接导出一份当前的 currentData
    // 为了简单，我们先导出当前的这一条 currentData
    if (!currentData) return;

    // 将 JS 对象转换成美化过的 JSON 字符串 (缩进为 2 个空格)
    const jsonString = JSON.stringify(currentData, null, 2);

    // 利用 Blob 对象，把字符串变成一个“文件”
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    // 创建一个隐藏的 a 标签，模拟点击下载
    const a = document.createElement("a");
    a.href = url;
    a.download = `mabsa_annotation_${currentData.tweetId}.json`; // 下载的文件名
    document.body.appendChild(a);
    a.click();

    // 清理战场
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 导入文件的核心函数
  // 考点：前端解析本地文本流
  const handleImportJSON = (file: File) => {
    const reader = new FileReader();

    // onLoad 是一个异步回调，当文件读取完毕时触发
    reader.onload = (e) => {
      try {
        // 1. 把读取到的纯文本转换成 JS 对象
        const parsedData = JSON.parse(e.target?.result as string);

        // 2. 防御性编程：检查这个 JSON 是不是我们系统能认的格式？
        // 只要它有 rawText 并且 aspects 是个数组，我们就姑且认为它是合法的
        if (
          parsedData &&
          parsedData.rawText &&
          Array.isArray(parsedData.aspects)
        ) {
          addNewData(parsedData); // 传给 Zustand 仓库
          message.success("数据导入成功！工作台已刷新。");
        } else {
          message.error("JSON 格式不合法：缺少 MABSA 核心字段。");
        }
      } catch (error) {
        message.error("解析失败，请确保文件是标准 JSON 格式。");
      }
    };
    // 命令 reader 已纯文本的形式去读取这个文件
    reader.readAsText(file);

    // 重要！！！：返回 false 会阻止 Ant Design 的默认上传行为
    return false;
  };

  // 如果数据还没回来，或者正在请求中，我们展示“骨架屏”
  if (isLoading) {
    return (
      <div style={{ padding: "20px" }}>
        <Title level={3}>加载中...</Title>
        <Row gutter={24}>
          <Col span={12}>
            <Card>
              <Skeleton active paragraph={{ rows: 10 }} />
            </Card>
          </Col>
          <Col span={12}>
            <Card>
              <Skeleton.Image
                active
                style={{ width: "100%", height: "400px" }}
              />
            </Card>
          </Col>
        </Row>
      </div>
    );
  }

  // 增加导出函数（导出纯正的 YOLO 训练格式 .txt）
  const handleExportYOLO = () => {
    if (!currentData || !imageContainerRef.current) return;

    // 1. 获取图片容器的实际宽高，用于计算归一化(0~1 之间的小数)
    const rect = imageContainerRef.current.getBoundingClientRect();
    const containerW = rect.width;
    const containerH = rect.height;

    // 2. 简单模拟一个 Class 映射表 (实际业务中，这应该是用户在系统设置里配好的)
    // 比如：["person", "car", "dog"] -> person=0, car=1, dog=2
    const uniqueLabels = Array.from(
      new Set(currentData.yoloBboxes.map((b) => b.label)),
    );

    let txtContent = "";

    // 核心计算：YOLO 的相对坐标转换
    currentData.yoloBboxes.forEach((box) => {
      const classId = uniqueLabels.indexOf(box.label);

      // 中心点坐标 = (左上角起点 + 宽高的一半) / 容器总宽高
      const xCenter = (box.x + box.width / 2) / containerW;
      const yCenter = (box.y + box.height / 2) / containerH;
      // 相对宽高 = 绝对宽高 / 容器总宽高
      const wNorm = box.width / containerW;
      const hNorm = box.height / containerH;

      // 拼凑成 YOLO 要求的空格分隔格式 (保留 6 位小数)
      txtContent += `${classId} ${xCenter.toFixed(6)} ${yCenter.toFixed(6)} ${wNorm.toFixed(6)} ${hNorm.toFixed(6)}\n`;
    });

    if (!txtContent) {
      message.warning("当前图片没有任何视觉框，无需导出！");
      return;
    }

    // 4. 触发浏览器下载
    const blob = new Blob([txtContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `yolo_labels_${currentData.tweetId}.txt`; // 生成对应的 txt 文件
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    message.success("YOLO 格式导出成功！可直接送入模型训练。");
  };

  // 打通 Python 后端的 AI 通信管道
  const handleAIpredict = async () => {
    if (!currentData) return;

    setIsPredicting(true); // 锁死按钮

    // 弹个轻提示，提示用户等待
    const hideLoading = message.loading("🤖 AI 大模型正在拼命识别特征中...", 0);

    try {
      // 1. 利用浏览器原生的 fetch API 发送 POST 请求
      const response = await fetch("http://localhost:8000/api/predict", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },

        // 把当前的数据喂给后端
        body: JSON.stringify({
          tweetId: currentData.tweetId,
          rawText: currentData.rawText,
          imageUrl: currentData.imageUrl,
        }),
      });
      const result = await response.json();

      if (result.status === "success") {
        // 2. 拿到 AI 返回的数据后，直接塞进我们的 Zustand 仓库
        result.data.yoloBboxes.forEach((box: any) =>
          addYoloBox(currentData.tweetId, box),
        );
        result.data.aspects.forEach((aspect: any) =>
          addAspect(currentData.tweetId, aspect),
        );

        hideLoading();
        message.success("✨ AI 预标注成功上屏！请进行人工核验。");
        setIsPredicting(false);
      } else {
        // 👇 【新增兜底】：处理后端主动抛出的业务错误，销毁转圈提示
        hideLoading();
        message.error(`🚨 AI 处理失败: ${result.message}`);
      }
    } catch (error) {
      hideLoading();
      message.error(
        "🚨 无法连接到 AI 后端服务器，请检查 Python 服务是否启动！",
      );
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      {/* 头部标题与操作区重构：大厂级中后台 Toolbar 设计 */}
      <div style={{ marginBottom: "24px" }}>
        {/* 第一行：信息展示层 */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "16px",
          }}
        >
          <div>
            <Title
              level={3}
              style={{
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              推文标注审查
              {/* 把超长的 ID 变小，变灰，提升界面的呼吸感 */}
              <span
                style={{
                  fontSize: "16px",
                  color: "#888",
                  fontWeight: "normal",
                }}
              >
                ID: {currentData?.tweetId}
              </span>
              {/* 数据状态锁 */}
              {currentData?.status === "done" && (
                <span
                  style={{
                    fontSize: 13,
                    color: "#52c41a",
                    background: "#f6ffed",
                    padding: "2px 8px",
                    border: "1px solid #b7eb8f",
                    borderRadius: 4,
                  }}
                >
                  🔒 审核已通过 (不可篡改)
                </span>
              )}
            </Title>
          </div>

          {/* 右上角的用户身份与退出 */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <span style={{ color: "#666" }}>
              当前登录: <b style={{ color: "#333" }}>{currentUser?.username}</b>
              <Tag
                color={currentUser?.role === "reviewer" ? "blue" : "default"}
                style={{ marginLeft: 8 }}
              >
                {currentUser?.role === "reviewer" ? "🕵️‍♂️ 审核员" : "👨‍💻 标注员"}
              </Tag>
            </span>
            <Button onClick={logout} danger type="text" size="small">
              退出系统
            </Button>
          </div>
        </div>

        {/* 第二行：高内聚的工具栏 (Toolbar) */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#f8f9fa", // 浅灰底色，划分出专门的操作区
            padding: "12px 16px",
            borderRadius: "8px",
            border: "1px solid #f0f0f0",
          }}
        >
          {/* 左侧功能组：数据管理（新增、导入导出折叠、删除） */}
          <Space size="middle">
            <Button
              type="primary"
              ghost
              onClick={() => setIsAddDataModalVisible(true)}
            >
              + 新增单条数据
            </Button>

            {/* 核心降噪：把低频的导入导出塞进 Dropdown 下拉菜单里 */}
            <Dropdown
              menu={{
                items: [
                  {
                    key: "import",
                    label: (
                      <Upload
                        beforeUpload={handleImportJSON}
                        showUploadList={false}
                        accept=".json"
                      >
                        <div>
                          <UploadOutlined /> 导入 JSON 文件
                        </div>
                      </Upload>
                    ),
                  },
                  {
                    key: "export_json",
                    label: "导出当前 JSON",
                    icon: <DownloadOutlined />,
                    onClick: handleExportJSON,
                  },
                  {
                    key: "export_yolo",
                    label: "导出 YOLO 格式 (.txt)",
                    icon: <DownloadOutlined />,
                    onClick: handleExportYOLO,
                    danger: true,
                  },
                ],
              }}
              trigger={["click"]}
            >
              <Button>数据导入/导出 ▾</Button>
            </Dropdown>

            {!isLockedForMe && (
              <Popconfirm
                title="⚠️ 永久删除数据"
                description="确定要从系统中彻底删除当前这条推文的所有数据吗？此操作无法撤销！"
                disabled={isLockedForMe || dataList.length === 0}
                onConfirm={() => {
                  deleteCurrentData();
                  message.success("🗑️ 数据已彻底销毁！");
                }}
                okText="确定删除"
                cancelText="取消"
                okButtonProps={{ danger: true }}
              >
                <Button
                  danger
                  type="text"
                  icon={<DeleteOutlined />}
                  disabled={dataList.length === 0 || isLockedForMe}
                >
                  删除当前数据
                </Button>
              </Popconfirm>
            )}
          </Space>

          {/* 中间功能组：翻页与审核（核心业务流转区） */}
          <Space size="middle">
            <Space.Compact>
              <Button
                disabled={currentIndex === 0}
                onClick={() => fetchData(currentIndex - 1)}
              >
                上一条
              </Button>
              {/* 页码指示器 */}
              <Button
                type="dashed"
                disabled
                style={{ color: "#333", cursor: "default" }}
              >
                {dataList.length > 0
                  ? `${currentIndex + 1} / ${dataList.length}`
                  : "0 / 0"}
              </Button>
              <Button
                type="primary"
                disabled={currentIndex === dataList.length - 1}
                onClick={() => fetchData(currentIndex + 1)}
              >
                下一条
              </Button>
            </Space.Compact>

            {/* 审核员的专属按钮 */}
            {currentUser?.role === "reviewer" &&
              currentData &&
              (currentData.status !== "done" ? (
                <Button
                  type="primary"
                  style={{ background: "#52c41a" }}
                  onClick={() => updateDataStatus(currentData.tweetId, "done")}
                >
                  ✅ 标记为审核通过
                </Button>
              ) : (
                <Button
                  danger
                  onClick={() =>
                    updateDataStatus(currentData.tweetId, "pending")
                  }
                >
                  ↩️ 撤销审核 (打回修改)
                </Button>
              ))}
          </Space>

          {/* 右侧功能组：AI 赋能（强视觉焦点区域） */}
          <Space>
            <Button
              type="primary"
              style={{ background: "#722ed1", borderColor: "#722ed1" }}
              onClick={handleAIpredict}
              loading={isPredicting}
              disabled={isPredicting || isLockedForMe}
            >
              ✨ 智能预标注
            </Button>

            <Button
              type="primary"
              style={{ backgroundColor: "#13c2c2", borderColor: "#13c2c2" }}
              icon={<RobotOutlined />}
              onClick={async () => {
                if (!currentData || !activeId) {
                  if (!activeId)
                    message.warning("请先在 AI 辅助中选择或创建一个对话");
                  return;
                }

                setIsCopilotOpen(true);
                const prompt = `我是一名多模态方面级情感分析的数据标注员，请帮我分析一下这条多模态推文数据中包括的方面词，以及方面词所对应的情感极性是什么（Positive | Negative | Neutral）？注意：方面词只存在在原文本中。\n原文本：${currentData.rawText}\n推文图片如上所示：`;
                const safeFetchUrl = currentData.imageUrl.replace(
                  "http://localhost:8000",
                  "",
                );

                try {
                  const response = await fetch(safeFetchUrl);
                  const blob = await response.blob();
                  const reader = new FileReader();

                  reader.onloadend = () => {
                    const base64data = reader.result as string;
                    const imageAttachment: Attachment = {
                      id: Date.now().toString(),
                      type: "image",
                      name: "current_tweet_image.jpg",
                      data: base64data,
                    };
                    sendMessage(activeId, prompt, [imageAttachment]);
                    message.success(
                      "已将当前多模态数据(Base64)传送至 AI 辅助！",
                    );
                  };
                  reader.readAsDataURL(blob);
                } catch (error) {
                  message.error("🚨 图片数据读取失败，无法传送！");
                }
              }}
            >
              AI深度提问
            </Button>
          </Space>
        </div>
      </div>

      {currentData ? (
        <Row gutter={24}>
          {/* 左侧：把 mockData 换成 currentData */}
          <Col span={12}>
            <Card title="文本特征分析" style={{ minHeight: "500px" }}>
              <Paragraph
                style={{ fontSize: "18px", lineHeight: "1.8", cursor: "text" }}
                onClick={handleMouseUp}
              >
                {renderHighlightedText(
                  currentData.rawText,
                  currentData.aspects,
                )}
              </Paragraph>
              <div style={{ marginTop: "20px" }}>
                <h4>识别到的实体 (Aspects) - 点击可修改:</h4>
                {currentData.aspects.map((aspect) => {
                  const menuItems: MenuProps["items"] = [
                    { key: "positive", label: "🟢 正向 (Positive)" },
                    { key: "negative", label: "🔴 负向 (Negative)" },
                    { key: "neutral", label: "🟡 中立 (Neutral)" },
                  ];

                  return (
                    <Dropdown
                      key={aspect.id}
                      trigger={["click"]}
                      disabled={isLockedForMe} // 👈 【新增】：锁死下拉菜单
                      menu={{
                        items: menuItems,
                        onClick: (e) => {
                          updateAspectPolarity(
                            currentData.tweetId,
                            aspect.id,
                            e.key as any,
                          );
                        },
                      }}
                    >
                      <Tag
                        // 拦截鼠标右键，执行删除操作
                        onContextMenu={(e) => {
                          e.preventDefault(); // 阻止浏览器默认的右键菜单弹出
                          // 👇 【新增】：锁定状态不让删
                          if (isLockedForMe) {
                            message.warning("🔒 该数据已审核通过，无法删除！");
                            return;
                          }
                          deleteAspect(currentData.tweetId, aspect.id);
                          message.success("🗑️ 已永久移除该方面词");
                        }}
                        style={{
                          fontSize: "16px",
                          padding: "5px 10px",
                          cursor: "pointer",
                        }}
                        color={
                          aspect.polarity === "positive"
                            ? "success"
                            : aspect.polarity === "negative"
                              ? "error"
                              : "warning"
                        }
                      >
                        {aspect.term} [{aspect.polarity}]
                      </Tag>
                    </Dropdown>
                  );
                })}
              </div>
            </Card>
          </Col>

          {/* 在整个页面的最外层，加上我们的悬浮菜单
            只有当 selectionWord 存在并且 visible 为 true 时才进行菜单的渲染 */}
          {selectedWord && selectedWord.visible && (
            <div
              ref={popupRef}
              style={{
                position: "fixed",
                left: `${selectedWord?.x || 0}px`,
                top: `${selectedWord?.y || 0}px`,
                backgroundColor: "#fff",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                borderRadius: "8px",
                padding: "10px",
                zIndex: 1000,
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div style={{ fontSize: "12px", color: "#888" }}>
                标记<strong>"{selectedWord.term}"</strong>为：
              </div>
              <Space>
                <Button
                  size="small"
                  style={{ borderColor: "#52c41a", color: "#52c41a" }}
                  onClick={() => confirmAddAspect("positive")}
                >
                  Positive
                </Button>
                <Button
                  size="small"
                  style={{ borderColor: "#52c41a", color: "#52c41a" }}
                  onClick={() => confirmAddAspect("negative")}
                >
                  Negative
                </Button>
                <Button
                  size="small"
                  style={{ borderColor: "#52c41a", color: "#52c41a" }}
                  onClick={() => confirmAddAspect("neutral")}
                >
                  Neutral
                </Button>
              </Space>
            </div>
          )}

          {/* 右侧：同样把 mockData 换成 currentData */}
          <Col span={12}>
            <Card title="YOLO 视觉特征" style={{ minHeight: "500px" }}>
              <div
                ref={imageContainerRef}
                style={{
                  position: "relative",
                  display: "inline-block",
                  cursor: "crosshair", // 鼠标会变成专业的准星十字
                  overflow: "hidden", // 限制 框 不能画出图片边界
                }}
                onMouseDown={handleMouseDown}
                onMouseUp={handleDrawMouseUp}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleDrawMouseUp}
              >
                <img
                  src={currentData.imageUrl}
                  alt="visual context"
                  style={{ maxWidth: "100%", height: "auto", display: "block" }}
                  draggable={false} // 【极其重要】：禁止浏览器原生拖拽图片的行为！否则会和你画框打架
                />
                {currentData.yoloBboxes.map((box) => (
                  <div
                    key={box.id}
                    style={{
                      position: "absolute",
                      left: `${box.x}px`,
                      top: `${box.y}px`,
                      width: `${box.width}px`,
                      height: `${box.height}px`,
                      border: "2px solid #f5222d",
                      backgroundColor: "rgba(245, 34, 45, 0.2)",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: "-24px",
                        left: "-2px",
                        backgroundColor: "#f5222d",
                        color: "white",
                        fontSize: "12px",
                        padding: "2px 6px",
                        borderRadius: "4px 4px 0 0",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {box.label}
                      {/* 只有当设置允许显示置信度时，才渲染百分比  */}
                      {settings.showConfidence &&
                        `${(box.confidence * 100).toFixed(0)}%`}
                    </span>

                    {/* 增加对象框右上角的删除按钮 */}
                    {!isLockedForMe && (
                      <Popconfirm
                        title="删除提示"
                        description="确定要删除这个机器视觉标注框吗？"
                        onConfirm={(e) => {
                          e?.stopPropagation();
                          deleteYoloBox(currentData.tweetId, box.id);
                        }}
                        onCancel={(e) => e?.stopPropagation()} // 取消时也阻止冒泡
                        okText="确定"
                        cancelText="取消"
                      >
                        <CloseCircleFilled
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          style={{
                            position: "absolute",
                            top: "-10px",
                            right: "-10px", // 删除按钮的位置放置在框的右上角部分
                            fontSize: "18px",
                            color: "#f5222d",
                            backgroundColor: "#fff",
                            borderRadius: "50%",
                            cursor: "pointer",
                            zIndex: 10, // 保证删除按钮在最上层，不会被别的盖住
                          }}
                        />
                      </Popconfirm>
                    )}
                  </div>
                ))}

                {/* 渲染正在画的半透明“幽灵虚线框” */}
                {drawingState.isDrawing && (
                  <div
                    style={{
                      position: "absolute",
                      left: `${Math.min(drawingState.currentX, drawingState.startX)}px`,
                      top: `${Math.min(drawingState.currentY, drawingState.startY)}px`,
                      width: `${Math.abs(drawingState.currentX - drawingState.startX)}px`,
                      height: `${Math.abs(drawingState.currentY - drawingState.startY)}px`,
                      border: "2px dashed #1890ff", // 蓝色虚线
                      backgroundColor: "rgba(24,144,255,0.2)", // 蓝色半透明填充

                      //【大厂面试必考点】：这行极其关键！
                      // 因为这个框会跟在你的鼠标下面，如果没有这行，鼠标就会悬停在框上
                      // 导致父元素的 mousemove 事件被遮挡中断，拖拽就会立刻卡死
                      pointerEvents: "none",
                      zIndex: 999, // 保证画的时候在最顶层
                    }}
                  />
                )}
              </div>
            </Card>
          </Col>
        </Row>
      ) : (
        // 👇 如果没数据，显示极其优雅的空状态提示
        <div
          style={{
            textAlign: "center",
            padding: "100px 20px",
            background: "#fafafa",
            borderRadius: "8px",
            marginTop: "20px",
          }}
        >
          <Title level={4} style={{ color: "#888" }}>
            📦 数据库当前空空如也
          </Title>
          <p style={{ color: "#aaa" }}>
            请点击右上角的“+ 新增单条数据”开始您的标注工作吧！
          </p>
        </div>
      )}
      {/* 数据录入的输入弹窗 */}
      <Modal
        title="➕ 录入单条多模态数据"
        open={isAddDataModalVisible}
        onOk={handleAddNewDataSubmit}
        onCancel={() => setIsAddDataModalVisible(false)}
        okText="确认入库"
        cancelText="取消"
        width={600}
        destroyOnHidden
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            marginTop: "16px",
          }}
        >
          <div>
            <h4>1. 输入推文文本 (必填)</h4>
            <Input.TextArea
              rows={4}
              placeholder="请输入你要分析的社交媒体推文文本..."
              value={newRawText}
              onChange={(e) => setNewRawText(e.target.value)}
            />
          </div>

          <div>
            <h4>2. 上传关联图片 (必填)</h4>
            <Upload
              beforeUpload={(file) => {
                setNewImageFile(file);
                return false;
              }}
              maxCount={1}
              accept="image/*"
            >
              <Button icon={<UploadOutlined />}>选择本地图片</Button>
            </Upload>
          </div>

          {/* 👇 【新增】：方面词快捷输入框 */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <h4>3. 预设方面词及其情感 (选填)</h4>
              {/* 点击按钮，往数组里塞入一个空对象，页面上就会多出一行 */}
              <Button
                type="dashed"
                size="small"
                icon={<PlusOutlined />}
                onClick={() =>
                  setManualAspects([
                    ...manualAspects,
                    {
                      id: Date.now().toString(),
                      term: "",
                      polarity: "neutral",
                    },
                  ])
                }
              >
                新增词汇
              </Button>
            </div>
            {/* 遍历数组，渲染每一行的输入框和下拉框 */}
            {manualAspects.map((aspect, index) => (
              <Space
                key={aspect.id}
                style={{ display: "flex", marginBottom: 8 }}
                align="baseline"
              >
                <Input
                  placeholder="输入原文中存在的词..."
                  value={aspect.term}
                  onChange={(e) => {
                    const newAspects = [...manualAspects];
                    newAspects[index].term = e.target.value;
                    setManualAspects(newAspects);
                  }}
                  style={{ width: "200px" }}
                />
                <Select
                  value={aspect.polarity}
                  onChange={(val) => {
                    const newAspects = [...manualAspects];
                    newAspects[index].polarity = val as AspectTerm["polarity"];
                    setManualAspects(newAspects);
                  }}
                  style={{ width: "150px" }}
                  options={[
                    { value: "positive", label: "🟢 正向 (Positive)" },
                    { value: "negative", label: "🔴 负向 (Negative)" },
                    { value: "neutral", label: "🟡 中立 (Neutral)" },
                  ]}
                />
                {/* 极其优雅的红色删除小圆钮 */}
                <MinusCircleOutlined
                  style={{
                    color: "#ff4d4f",
                    cursor: "pointer",
                    fontSize: "16px",
                    marginLeft: "8px",
                  }}
                  onClick={() => {
                    const newAspects = [...manualAspects];
                    newAspects.splice(index, 1); // 从数组里切除这一项
                    setManualAspects(newAspects);
                  }}
                />
              </Space>
            ))}

            <div style={{ fontSize: "12px", color: "#888", marginTop: "4px" }}>
              * 系统会自动在文本中查找这些词，如果输入的词不在原文中将自动忽略。
            </div>
          </div>

          <div>
            <h4>4. 导入 YOLO 视觉标注框 (选填, .txt 格式)</h4>
            <Upload
              beforeUpload={(file) => {
                setNewYoloFile(file);
                return false;
              }}
              maxCount={1}
              accept=".txt"
            >
              <Button icon={<UploadOutlined />}>导入 YOLO 标签文件</Button>
            </Upload>
            <div style={{ fontSize: "12px", color: "#888", marginTop: "4px" }}>
              * 如果不导入，您可以稍后在工作台中使用大模型预标注或手动绘制。
            </div>
          </div>
        </div>
      </Modal>

      {/* YOLO 标注框的输入弹窗 */}
      <Modal
        title="✨ 添加视觉特征标签"
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        okText="保存框选"
        cancelText="取消"
        destroyOnHidden
      >
        <div style={{ marginBottom: "10px" }}>
          请输入该目标的类别名称（例如: car, person, background）：
        </div>
        <Input
          autoFocus // 弹窗一开，鼠标光标自动锁定在这里，方便直接打字
          placeholder="请输入类别..."
          value={labelInput}
          onChange={(e) => setLabelInput(e.target.value)}
          onPressEnter={handleModalOk}
        />
      </Modal>
      {/* 🤖 悬浮在右下角的唤醒按钮 */}
      <FloatButton
        icon={<RobotOutlined />}
        type="primary"
        style={{ right: 24, bottom: 24, width: 60, height: 60 }}
        onClick={() => setIsCopilotOpen(true)}
        tooltip="唤醒 AI 辅助"
      />

      {/* 🤖 AI 智能副驾侧边栏 (Drawer) */}
      <Drawer
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <RobotOutlined style={{ color: "#1890ff", fontSize: 24 }} />
            <span style={{ fontSize: 18, fontWeight: "bold" }}>
              AI 智能多模态辅助
            </span>
          </div>
        }
        placement="right"
        onClose={() => setIsCopilotOpen(false)}
        open={isCopilotOpen}
        width={800}
        styles={{
          body: {
            padding: 0,
          },
        }} // 让 ChatArea 铺满
        mask={false} // 【极其重要】：设为 false 代表打开抽屉时不会有黑色遮罩挡住左侧画板！
      >
        {/* ✅ 3.2 完美的左右分栏布局 */}
        <div style={{ display: "flex", width: "100%", height: "100%" }}>
          <Sidebar /> {/* 左侧：包含新建会话、历史列表和设置 */}
          <ChatArea /> {/* 右侧：聊天主界面 */}
        </div>
      </Drawer>
    </div>
  );
};

export default Workspace;
