import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { Card, Row, Col, Typography } from "antd";
import { useDataState } from "../store/useDataStore";
import type { MultimodalData } from "../types";

const { Title } = Typography;

const Dashboard: React.FC = () => {
  // ✅ 核心修改 1：从仓库中不仅拿出 dataList，还要把拉取数据的 loadAllData 方法拿出来
  const { dataList, loadAllData } = useDataState();

  const pieChartRef = useRef<HTMLDivElement>(null);
  const barChartRef = useRef<HTMLDivElement>(null);

  // 🚀 Hook 1：主动出击要数据
  // 当我们直接登录进入大盘时，如果发现本地没数据，立刻去呼叫后端
  useEffect(() => {
    if (dataList.length === 0) {
      loadAllData();
    }
  }, []);

  // 🚀 Hook 2：负责“修场地” (初始化实例与销毁)
  // 这个 Hook 的依赖项是 []，意味着它只在页面挂载时执行一次
  useEffect(() => {
    if (!pieChartRef.current || !barChartRef.current) return;

    // 1. 初始化 Echarts 实例
    const mypieChart = echarts.init(pieChartRef.current);
    const mybarChart = echarts.init(barChartRef.current);

    // 2. 监听浏览器窗口变化，让图表能自适应缩放
    const handleResize = () => {
      mypieChart.resize();
      mybarChart.resize();
    };
    window.addEventListener("resize", handleResize);

    // 3. 页面离开时，彻底销毁实例，释放内存！！！
    return () => {
      window.removeEventListener("resize", handleResize);
      mypieChart.dispose();
      mybarChart.dispose();
    };
  }, []); // 👈 依赖为空数组，绝不重复执行

  // 🚀 Hook 3：负责“倒颜料” (监听数据变化并重绘)
  // 这个 Hook 的依赖项是 [dataList]，只要数据仓库一更新，它就立刻重新执行！
  useEffect(() => {
    if (!pieChartRef.current || !barChartRef.current) return;

    // 1. 不要重新 init！而是从刚才修好的 DOM 场地上，把图表实例“捞”回来
    const mypieChart = echarts.getInstanceByDom(pieChartRef.current);
    const mybarChart = echarts.getInstanceByDom(barChartRef.current);

    if (!mypieChart || !mybarChart) return;

    // 2. 开始你的核心数据统计逻辑
    let pos = 0,
      neg = 0,
      neu = 0;
    dataList.forEach((data: MultimodalData) => {
      data.aspects.forEach((aspect) => {
        if (aspect.polarity === "positive") pos++;
        else if (aspect.polarity === "negative") neg++;
        else neu++;
      });
    });

    const xData = ["1", "2", "3", "4", "5", "6++"];
    const yData = [0, 0, 0, 0, 0, 0];
    dataList.forEach((data: MultimodalData) => {
      const aspect_count = data.aspects.length;
      if (aspect_count) {
        if (aspect_count >= 6) {
          yData[5]++;
        } else {
          yData[aspect_count - 1]++;
        }
      }
    });

    // 3. 组装配置项
    const pie_option = {
      title: { text: "MABSA 情感极性分布", left: "center" },
      tooltip: { trigger: "item" },
      legend: { orient: "vertical", left: "left" },
      color: ["#91cc75", "#ee6666", "#fac858"],
      label: { show: true, formatter: "{b}: {d}%" },
      series: [
        {
          name: "情感数量",
          type: "pie",
          radius: ["40%", "70%"],
          data: [
            { value: pos, name: "Positive(正向)" },
            { value: neg, name: "Negative(负向)" },
            { value: neu, name: "neutral(中立)" },
          ],
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: "rgba(0, 0, 0, 0.5)",
            },
          },
        },
      ],
    };

    const bar_option = {
      title: { text: "Top 方面词词频统计", left: "center" },
      tooltip: { trigger: "axis" },
      xAxis: { type: "category", name: "方面词个数", data: xData },
      yAxis: { type: "value", name: "实例数量", minInterval: 1 },
      series: [
        {
          name: "实例数量",
          type: "bar",
          data: yData,
          itemStyle: { color: "#5470c6" },
          label: { show: true, position: "top" },
        },
      ],
    };

    // 4. 将最新的数据交给实例进行渲染覆盖
    mypieChart.setOption(pie_option);
    mybarChart.setOption(bar_option);
  }, [dataList]); // 👈 核心修改 2：加上依赖项，变成一个响应式图表！

  return (
    <div style={{ padding: "20px" }}>
      <Title level={3}>系统数据大盘</Title>
      <Row gutter={24}>
        <Col span={12}>
          <Card>
            <div
              ref={pieChartRef}
              style={{ width: " 100%", height: "400px" }}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card>
            <div
              ref={barChartRef}
              style={{
                width: "100%",
                height: "400px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ccc",
              }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
