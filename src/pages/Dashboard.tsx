import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { Card, Row, Col, Typography } from "antd";
import { mockDataList } from "../utils/mockData";

const { Title } = Typography;

const Dashboard: React.FC = () => {
  // 考点 1. useRef 获取真实 DOM
  // React 是虚拟 DOM，但 ECharts 需要操作真实的 HTML div
  // useRef 就像一根“钩子”，用来在页面渲染完成后，钩住那个我们要画的 div
  const pieChartRef = useRef<HTMLDivElement>(null);
  const barChartRef = useRef<HTMLDivElement>(null);

  // 考点 2. useEffect 控制 DOM 渲染时机
  // useEffect 里的代码，会在组件“已经成功挂载到屏幕上”之后才执行
  // 这就可以保证我们画图时，那个 div 标签是绝对存在的
  useEffect(() => {
    // 1. 安全检查：如果钩子没有勾到 div，直接退出
    if (!pieChartRef) {
      return;
    }
    if (!barChartRef) {
      return;
    }

    // 2. 初始化 Echarts 实例
    const mypieChart = echarts.init(pieChartRef.current);
    const mybarChart = echarts.init(barChartRef.current);

    // 3. 数据计算：遍历我们所有的假数据，统计情感标签的数量
    let pos = 0,
      neg = 0,
      neu = 0;
    mockDataList.forEach((data) => {
      data.aspects.forEach((aspect) => {
        if (aspect.polarity === "positive") pos++;
        else if (aspect.polarity === "negative") neg++;
        else neu++;
      });
    });

    // 数据计算：遍历我们所有的假数据，统计每个实例中的方面词个数
    const xData = ["1", "2", "3", "4", "5", "6++"];

    const yData = [0, 0, 0, 0, 0, 0];
    mockDataList.forEach((data) => {
      // 获取当前这个实例里有几个方面词
      const aspect_count = data.aspects.length;
      if (aspect_count) {
        if (aspect_count >= 6) {
          yData[5]++;
        } else {
          yData[aspect_count - 1]++;
        }
      }

      // 统计逻辑：有则 +1，无则设为 1
    });

    // 4. Echarts 的配置项（图表长什么样，数据是什么）
    const pie_option = {
      title: { text: "MABSA 情感极性分布", left: "center" },
      tooltip: { trigger: "item" }, // 鼠标放上去会有提示框
      legend: { orient: "vertical", left: "left" },
      color: ["#91cc75", "#ee6666", "#fac858"],
      label: {
        show: true,
        formatter: "{b}: {d}%", // {b}是全称，{d}是百分比
      },
      series: [
        {
          name: "情感数量",
          type: "pie",
          radius: ["40%", "70%"], // 内部半径40%，外部半径70%
          data: [
            {
              value: pos,
              name: "Positive(正向)",
            },
            {
              value: neg,
              name: "Negative(负向)",
            },
            {
              value: neu,
              name: "neutral(中立)",
            },
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
    // Echarts 的配置项
    const bar_option = {
      title: { text: "Top 方面词词频统计", left: "center" },
      tooltip: { trigger: "axis" }, // 柱状图一般用 axis 触发提示
      // X 轴配置
      xAxis: {
        type: "category", // 类目轴
        name: "方面词个数", // x 轴的小标题
        data: xData, // 填入你的 X 轴数组，比如 ['苹果', '电池']
      },
      // Y 轴配置
      yAxis: {
        type: "value", // 数值轴
        name: "实例数量", // y 轴小标题
        minInterval: 1, // 保证 Y 轴刻度是整数（因为词频不可能是 1.5 次）
      },
      series: [
        {
          name: "实例数量",
          type: "bar", // 告诉 ECharts 画柱状图
          data: yData,
          itemStyle: { color: "#5470c6" }, // 给柱子定个颜色
          label: {
            show: true,
            position: "top",
          },
        },
      ],
    };

    // 5. 将配置交给实例，正式渲染图表
    mypieChart.setOption(pie_option);
    mybarChart.setOption(bar_option);

    // 6. 监听浏览器窗口变化，让图表能自适应缩放
    const handleResize = () => {
      mypieChart.resize();
      mybarChart.resize();
    };
    window.addEventListener("resize", handleResize);

    // 考点 3. 组件销毁与防止内存泄漏
    // useEffect 返回的函数叫“清理函数”
    // 当我们离开这个页面时，React 会自动执行这里的代码
    // 面试官及其看重你是否写了 `myChart.dispose()`
    return () => {
      window.removeEventListener("resize", handleResize); // 卸载浏览器事件

      mypieChart.dispose(); // 彻底销毁 Echarts 实例，释放内存！！！
      mybarChart.dispose();
    };
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <Title level={3}>系统数据大盘</Title>
      <Row gutter={24}>
        <Col span={12}>
          <Card>
            {/* 把 ref 绑到这个 div 上。
                注意：作为图表的容器，必须要有高度（height），否则图表会因为高度为 0 而隐形！ 
            */}
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
