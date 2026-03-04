import {
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
} from "@ant-design/icons";

const { Title, Paragraph } = Typography;

const Workspace: React.FC = () => {
  // 从 Zustand 仓库里把状态和方法“提取”出来
  const {
    currentData,
    currentIndex,
    isLoading,
    fetchData,
    updateAspectPolarity,
    deleteYoloBox,
    addNewData,
    dataList,
    addAspect,
    addYoloBox,
    settings,
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

  // 组件刚挂载到屏幕上时，我们请求第 0 条数据
  useEffect(() => {
    fetchData(0);
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
  const handleDrawMouseUp = (e: React.MouseEvent) => {
    if (!drawingState.isDrawing || !currentData) return;

    const { startX, startY, currentX, currentY } = drawingState;

    // 几何魔法：计算最终的 x, y, width, height
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    const finalX = Math.min(startX, currentX);
    const finalY = Math.min(startY, currentY);

    // 防御编程：过滤掉误触（比如只是随便点了一下，没拖拽）
    if (width > 10 && height > 10) {
      // 弹个窗口 询问用户这个东西叫什么名字？
      const labelName = window.prompt(
        "请输入新框选目标的名称（如：car, tree）",
        "new_target",
      );
      if (labelName) {
        const newBox = {
          id: `box_${labelName}`,
          label: labelName,
          confidence: 1.0,
          x: finalX,
          y: finalY,
          width,
          height,
        };
        addYoloBox(currentData.tweetId, newBox);
      }
    }

    // 检测设置，执行自动下一条
    if (settings.autoNext) {
      if (currentIndex < dataList.length - 1) {
        message.success("画框成功！已自动为您切换下一条...");
        fetchData(currentIndex + 1);
      } else {
        message.info("这已经是最后一条数据啦！");
      }
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
        message.error("'解析失败，请确保文件是标准 JSON 格式。'");
      }
    };
    // 命令 reader 已纯文本的形式去读取这个文件
    reader.readAsText(file);

    // 重要！！！：返回 false 会阻止 Ant Design 的默认上传行为
    return false;
  };

  // 如果数据还没回来，或者正在请求中，我们展示“骨架屏”
  if (isLoading || !currentData) {
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

  return (
    <div style={{ padding: "20px" }}>
      {/* 头部标题区：加上了上一条/下一条按钮 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <Title level={3} style={{ margin: 0 }}>
          推文标注审查 (ID: {currentData.tweetId})
        </Title>
        <Space>
          {/* 增加包在 Upload 里的导入按钮 
              accept=".json" 限制了只能选择 json 文件
              beforeUpload 钩子就是我们拦截上传的关键
          */}
          <Upload
            beforeUpload={handleImportJSON}
            showUploadList={false}
            accept=".json"
          >
            <Button icon={<UploadOutlined />}>导入 Json</Button>
          </Upload>
          <Button
            disabled={currentIndex === 0}
            onClick={() => {
              fetchData(currentIndex - 1);
            }}
          >
            上一条
          </Button>
          <Button
            type="primary"
            onClick={() => {
              fetchData(currentIndex + 1);
            }}
            disabled={currentIndex === dataList.length - 1}
          >
            下一条
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExportJSON}>
            导出当前的 JSON 文件
          </Button>
        </Space>
      </div>
      <Row gutter={24}>
        {/* 左侧：把 mockData 换成 currentData */}
        <Col span={12}>
          <Card title="文本特征分析" style={{ minHeight: "500px" }}>
            <Paragraph
              style={{ fontSize: "18px", lineHeight: "1.8", cursor: "text" }}
              onClick={handleMouseUp}
            >
              {renderHighlightedText(currentData.rawText, currentData.aspects)}
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
              left: `${selectedWord.x}`,
              top: `${selectedWord.y}`,
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
                  <Popconfirm
                    title="删除提示"
                    description="确定要删除这个机器视觉标注框吗？"
                    onConfirm={() => deleteYoloBox(currentData.tweetId, box.id)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <CloseCircleFilled
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
    </div>
  );
};

export default Workspace;
