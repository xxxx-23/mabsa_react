import React from "react";
import { Card, Typography, Switch, Form, Divider, message, Alert } from "antd";
import {
  SettingOutlined,
  BulbOutlined,
  ExperimentOutlined,
} from "@ant-design/icons";
import { useDataState } from "../store/useDataStore";

const { Title, Text } = Typography;

const Settings: React.FC = () => {
  // 从我们的全局仓库把设置状态和修改方法拿出来
  const { settings, updateSettings } = useDataState();

  // 当开关切换时触发的函数
  const handleSettingChange = (
    key: keyof typeof settings,
    checked: boolean,
  ) => {
    updateSettings({ [key]: checked });
    message.success("设置已实时保存！");
  };

  return (
    <div style={{ padding: "20px", maxWidth: " 800PX", margin: "0 auto" }}>
      <div
        style={{ display: "flex", alignItems: "center", marginBottom: "20PX" }}
      >
        <SettingOutlined
          style={{ fontSize: "28px", color: "#1890ff", marginRight: "12px" }}
        />
        <Title level={2} style={{ margin: "0" }}>
          系统设置
        </Title>
      </div>

      <Alert
        message="配置实时生效"
        description="您的所有标注偏好设置都会立即同步到多模态标注工作台 (Workspace) 中。"
        type="info"
        showIcon
        style={{ marginBottom: "24px" }}
      />
      <Card>
        <Form layout="vertical">
          {/* 设置项 1 */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: "16px", fontWeight: "bold" }}>
                <ExperimentOutlined style={{ marginRight: "8px" }} />
                显示置信度 (Confidence)
              </div>
              <Text type="secondary">
                在工作台的 YOLO 视觉框上方，显示机器预标注的置信度百分比。
              </Text>
            </div>
            <Switch
              checked={settings.showConfidence}
              onChange={(checked) =>
                handleSettingChange("showConfidence", checked)
              }
            />
          </div>

          <Divider />

          {/* 设置项 2 */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: "16px", fontWeight: "bold" }}>
                <BulbOutlined style={{ marginRight: "8px" }} />
                开启连贯标注模式 (实验性)
              </div>
              <Text type="secondary">
                在此模式下，当你确认添加一个新的视觉标注框后，系统将自动提示是否翻到下一页。
              </Text>
            </div>
            <Switch
              checked={settings.autoNext}
              onChange={(checked) => handleSettingChange("autoNext", checked)}
            />
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default Settings;
