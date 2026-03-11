
// 1. 定义文本中的“方面词”及情感
export type AspectTerm = {
    id: string,
    term: string,  // 方面词本题
    polarity: 'positive' | 'negative' | 'neutral', // 情感极性
    startIndex: number, // 方面词的起始位置
    endIndex: number // 方面词的结束位置
}


// 2. 定义 YOLO 目标检测的边界框 (用于在图片上画框)
export type BoundingBox = {
    id: string,
    label: string, // 检测到的物体类别
    confidence: number // 置信度分数
    // 框的相对坐标
    x: number,
    y: number,
    width: number,
    height: number,
}

// 3. 核心数据体：聚合了文本、图像、MABSA 标签和 YOLO 视觉特征
export type MultimodalData = {
    tweetId: string,
    rawText: string, // 原始的推文文本
    aspects: AspectTerm[], // 该文本包含的方面词集合（有些不止一个方面词）
    imageUrl: string,
    yoloBboxes: BoundingBox[]

    // 新增：为了权限系统准备的字段
    status?: 'pending' | 'done', // 当前数据的状态：待审核 / 已完成
    annotator?: string // 这条数据是谁标的？
}