# OhMyPaper

这是一个基于 **Electron + React + Vite + Python bridge** 的论文桌面客户端项目，面向论文搜索、阅读、收藏、本地 PDF 管理与 AI 论文助手场景。

> [!IMPORTANT]
> **本项目是一个纯 Vibe Coding 产物。**
> 
> 也就是说，这个项目主要通过人与 AI 持续对话、快速迭代、边用边改的方式完成，而不是传统的大规模前置设计与长周期手工开发。
> 
> 如果你在使用、围观或二次开发这个项目，请默认它保持着 **高迭代、强实验性、重体验驱动** 的特征。

## 使用流程

推荐按下面的顺序开始使用：

1. **先进行匿名注册**
   - 打开应用后会自动匿名注册，拿到可用的连接 Token。
2. **再配置 AI 助手**
   - 填写 AI Provider、模型和 `OPENAI_API_KEY` 等配置。
3. **可以联系原作者获取 Key 体验卡**
   - 如果你只是想快速体验 AI 论文助手能力，可以先找原作者要一个 Key 体验卡，再填入设置页进行体验。
4. **完成后即可正常使用全部核心流程**
   - 包括论文搜索、详情阅读、应用内 PDF 阅读、收藏分组、本地 PDF 导入，以及对当前论文发起 AI 问答。

一句话版本：**先匿名注册，再配置 AI，拿到 Key 后即可尽情使用。**

## 致谢

OhMyPaper 的论文能力建立在 **DeepXiv 官方 SDK / 官方能力接口** 之上。

- 特别感谢原仓库：`DeepXiv/deepxiv_sdk`
- 原仓库链接：`https://github.com/DeepXiv/deepxiv_sdk`

如果你在使用这个桌面客户端，请也关注和支持原始项目与官方生态。

## 主要能力

- 多源论文搜索
- 论文详情阅读与应用内 PDF 阅读
- 收藏、最近访问、分组管理、本地 PDF 导入
- AI 论文助手，对当前论文进行上下文问答
- Electron 桌面封装，支持发布 macOS `dmg` 与 Windows `exe` 安装包

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

说明：

- 从源码运行时需要本机具备一个可用的 Python 3.10+ 来创建 `.venv`
- 正式打包出来的桌面安装包会内置独立的 `bridge` 可执行文件，最终用户不需要额外安装 Python

## 本地打包

```bash
npm run dist:mac
npm run dist:win
```

打包结果默认输出到 `release/`：

- macOS：`dmg`
- Windows：`exe` 安装包

## 发布说明

- 仓库不会内置任何真实 `OPENAI_API_KEY`
- AI 设置中的密钥需要由最终用户自行填写
- 推荐通过 GitHub Actions 在对应系统上构建发布包，以确保 macOS / Windows 安装包可正常运行
