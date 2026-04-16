# DeepxivAPP

这是一个基于 **Electron + React + Vite + Python bridge** 的 DeepXiv 桌面客户端项目，面向论文搜索、阅读、收藏、本地 PDF 管理与 AI 论文助手场景。

## 致谢

本项目的论文能力建立在 **DeepXiv 官方 SDK / 官方能力接口** 之上。

- 特别感谢原仓库：`DeepXiv/deepxiv_sdk`
- 原仓库链接：`https://github.com/DeepXiv/deepxiv_sdk`

如果你在使用这个桌面客户端，请也关注和支持原始项目与官方生态。

## 主要能力

- 多源论文搜索
- 论文详情阅读与应用内 PDF 阅读
- 收藏、最近访问、分组管理、本地 PDF 导入
- AI 论文助手，对当前论文进行上下文问答
- Electron 桌面封装，支持发布 macOS / Windows 安装包

## 项目结构

- `electron/`：Electron 主进程、IPC、桌面壳逻辑
- `renderer/`：React + Vite 渲染层
- `python/`：DeepXiv SDK bridge 与 PDF 解析逻辑
- `scripts/`：环境初始化与辅助脚本

## 本地开发

```bash
./scripts/setup_python.sh
npm install
npm run dev
```

## 本地打包

```bash
npm run dist:mac
npm run dist:win
```

打包结果默认输出到 `release/`。

## 发布说明

- 仓库不会内置任何真实 `OPENAI_API_KEY`
- AI 设置中的密钥需要由最终用户自行填写
- 推荐通过 GitHub Actions 在对应系统上构建发布包，以确保 macOS / Windows 安装包可正常运行
