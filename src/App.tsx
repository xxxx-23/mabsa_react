import { Card, Button, Input, Select, Typography, Space, Layout } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { useState } from "react";
import BasicLayout from "./components/BasicLayout";
import { useDataState } from "./store/useDataStore";

const { Title } = Typography;

function App() {
  // 从全局仓库拿出用户身份和登录方法
  const { currentUser, login } = useDataState();

  // 登录表单的局部状态
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"annotator" | "reviewer">("annotator");

  //如果已经登陆了，直接放行进入工作台
  if (currentUser) {
    return (
      <div>
        {/* 渲染写好的布局组件 */}
        <BasicLayout />
      </div>
    );
  }

  // 如果没有登陆，渲染登录拦截界面
  return (
    <Layout
      style={{
        height: "100vh",
        justifyContent: "center",
        alignItems: "center",
        background: "#f0f2f5",
      }}
    >
      <Card
        style={{
          width: 400,
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          borderRadius: 12,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <Title level={3} style={{ margin: 0, color: "#1890ff" }}>
            MABSA 标注平台
          </Title>
          <div style={{ color: "#888", marginTop: 8 }}>
            企业级多模态情感分析协作系统
          </div>
        </div>

        <Space orientation="vertical" size="large" style={{ width: "100%" }}>
          <Input
            size="large"
            prefix={<UserOutlined />}
            placeholder="请输入您的工号 / 姓名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Select
            size="large"
            style={{ width: "100%" }}
            value={role}
            onChange={(val) => setRole(val)}
            options={[
              { value: "annotator", label: "👨‍💻 身份：数据标注员 (Annotator)" },
              { value: "reviewer", label: "🕵️‍♂️ 身份：质量审核员 (Reviewer)" },
            ]}
          />
          <Button
            type="primary"
            size="large"
            block
            disabled={!username.trim()}
            onClick={() => login(username, role)}
          >
            登录系统
          </Button>
        </Space>
      </Card>
    </Layout>
  );
}

export default App;
