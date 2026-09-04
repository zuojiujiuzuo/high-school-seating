# 班阵

面向高中教师的本地排座工作台。提供名单管理、教室布局、关系规则、候选方案生成和文件导出的一体化工作流。

线上版本：<http://139.196.115.78:8088/>

## 本地运行

```bash
nvm use 24.14.0
npm install
npm run dev
```

浏览器访问 `http://127.0.0.1:1420`。进入页面会先显示免责声明；确认后可通过顶部的“名单、布局、排座、导出”四步完成工作流。

## 验证

```bash
npm run test:run
npm run build
```

Tauri 桌面壳已完成配置，但本机需要先安装 Rust 工具链和对应平台依赖后才能运行 `npm run tauri dev`。

## 当前可操作内容

- 在 Canvas 中点击或框选学生；滚轮缩放，移动工具拖动画布。
- 将左侧待入座名单拖到空座位。
- 拖动已入座学生到另一座位，观看双向弧线换位动效。
- 使用“座位”点击添加或拖动座位，使用“过道”左右拖动统一调整组间距。
- 使用“讲台”点击或拖动调整位置，使用“空位”把学生退回待入座名单。
- 每个画布工具都会显示即时操作提示，按 Esc 可随时回到选择工具。
- 在同一个“排座”页面创建四类多人规则、查看冲突诊断并生成三个候选方案。
- 有规则的学生在座位左侧显示深色“规”标记；点击可查看该学生参与的全部规则。
- 切换六种布局预设并立即更新 Canvas；布局页隐藏名单，可调整教室门位置，并用“禁用”工具切换带粗叉标识的禁用座位。
- 使用撤销/重做、纯净视图和降低动态效果。
- 在顶部切换班级和座位版本；每个组合拥有独立的本地座位快照。
- 从 `.xlsx` 或 `.csv` 文件读取学生名单、调整字段映射，并按学号新增或更新学生。
- 根据算法与权重生成三个可比较方案；候选预览和按规则重排后仍可直接拖动学生微调。
- 导出真正的 Excel、PowerPoint、PNG、SVG，或通过打印窗口另存 PDF。
- 使用右上角主题切换器在“简约”和“猫爪”高保真主题之间即时切换；选择会保存在本机。
- 点击右上角醒目的“免责声明”，查看本地数据、AI 合规、人工复核、维护及责任说明。

正式产品需求见 [docs/PRODUCT_REQUIREMENTS.md](docs/PRODUCT_REQUIREMENTS.md)，免责声明草案见 [docs/LEGAL_NOTICE.md](docs/LEGAL_NOTICE.md)，视觉令牌见 [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)。

## 服务器部署

仓库跟踪已构建的 `dist/`，服务器只需拉取仓库并让 Nginx 指向该目录：

```bash
cd /srv/high-school-seating
git pull --ff-only
nginx -t && systemctl reload nginx
```

Nginx 示例配置见 [deploy/nginx/high-school-seating.conf](deploy/nginx/high-school-seating.conf)。修改源代码后，请先在 Node.js 20.19 以上环境执行 `npm run build` 并提交新的 `dist/`。
