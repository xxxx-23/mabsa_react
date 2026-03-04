import {
  DashboardOutlined,
  EditOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { Layout, Menu, theme } from "antd";
import { useState } from "react";
import Workspace from "../pages/Workspace";
import Dashboard from "../pages/Dashboard";
import Settings from "../pages/Setting";

const { Header, Sider, Content } = Layout;

const BasicLayout: React.FC = () => {
  // 用于控制左边状态栏是否收起的状态
  const [collapsed, setCollapsed] = useState(false);

  // 用一个状态来记录当前选中的是哪个菜单（默认是 '1' 即数据大盘）
  const [activeMenu, setActiveMenu] = useState("1");

  // 获取 Ant Design 的默认主题色， 用于背景
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  return (
    // 整个布局占满全屏 100vh
    <Layout style={{ minHeight: "100vh" }}>
      {/* 1. 左侧边栏 */}
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => {
          setCollapsed(value);
        }}
      >
        <div
          style={{
            height: 32,
            margin: 16,
            background: "rgba(255, 255, 255, 0.2)",
            borderRadius: 6,
          }}
        />
        <Menu
          theme="dark"
          defaultSelectedKeys={["1"]}
          mode="inline"
          // 当点击菜单时，更新我们的 activeMenu 状态
          onClick={(e) => {
            setActiveMenu(e.key);
          }}
          items={[
            {
              key: "1",
              icon: <DashboardOutlined />,
              label: "数据大盘",
            },
            {
              key: "2",
              icon: <EditOutlined />,
              label: "MABSA 标注工作台",
            },
            {
              key: "3",
              icon: <SettingOutlined />,
              label: "系统设置",
            },
          ]}
        />
      </Sider>
      {/* 右侧主体区域 */}
      <Layout>
        {/* 顶部导航栏 */}
        <Header style={{ padding: 0, background: colorBgContainer }}>
          <h2 style={{ margin: "0 20px" }}>多模态情感分析（MABSA）平台</h2>
        </Header>

        {/* 核心内容区 */}
        <Content style={{ margin: "16px" }}>
          <div
            style={{
              padding: 24,
              minHeight: 360,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            {/* 条件渲染！根据 activeMenu 显示不同的组件*/}
            {activeMenu === "1" && <Dashboard />}
            {activeMenu === "2" && <Workspace />}
            {activeMenu === "3" && <Settings />}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default BasicLayout;
