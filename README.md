# Open code CLI 中文注入

面向 Windows 的 OpenCode CLI 简体中文注入工具。双击 VBS 入口即可打开深色图形界面，完成程序检测、中文注入、状态检查和英文原版恢复。

当前适配官方 npm 包 **@opencode/cli 2.2.5 的 Windows x64 发行文件**，覆盖终端菜单、二级弹窗、常用提示和命令行帮助。

## 环境与版本

| 项目 | 要求 |
| --- | --- |
| 操作系统 | Windows x64 |
| OpenCode CLI | @opencode/cli 2.2.5，发行文件需匹配补丁指纹 |
| Node.js | 22 或更新版本，node.exe 可通过 PATH 找到 |
| 图形界面 | Windows PowerShell 5.1、.NET Framework 4.8 |
| VBS 入口 | Windows Script Host |

工具会校验目标文件的 SHA-256。即使版本号相同，不同架构、baseline 构建或其他来源的文件也可能无法匹配。支持的文件指纹记录在 profiles.json 中。

## 快速开始

1. 下载仓库 ZIP 并完整解压，保留各文件的相对位置。
2. 确认已安装支持的 OpenCode CLI 和 Node.js。
3. 双击 **启动工具.vbs**，打开 **Open code CLI 中文注入** 窗口。
4. 点击 **自动检测**，或用 **选择程序** 指定 opencode.exe。
5. 点击 **检查状态**，确认版本和当前汉化状态。
6. 关闭正在使用该程序的 OpenCode 会话，再点击 **一键注入中文**。
7. 等待进度完成，然后点击 **打开 OpenCode**。

也可以直接运行同目录下的 OpenCodeZhCNTool.exe。重复启动会唤起已有工具窗口。

如果尚未安装对应版本，可使用 npm 安装。

~~~powershell
npm install -g @opencode/cli@2.2.5
~~~

通过 npm 全局安装后，可用以下命令查找全局包目录。

~~~powershell
npm root -g
~~~

目标程序通常位于该目录下的 @opencode\cli\bin\opencode.exe。本机自定义安装路径也可以手动选择，例如 D:\OpenCodeCLI\node_modules\@opencode\cli\bin\opencode.exe。

## 窗口操作

| 按钮或字段 | 功能 |
| --- | --- |
| 选择程序 | 选择实际的 opencode.exe 文件 |
| 自动检测 | 检查常见安装位置和已保存的程序路径 |
| 启动目录 | 设置通过工具打开 OpenCode 时使用的工作目录 |
| 一键注入中文 | 核对发行文件、保存原版备份、生成并验证汉化副本，再替换目标程序 |
| 还原原版 | 从校验通过的备份恢复英文原版 |
| 检查状态 | 显示版本、汉化状态和当前补丁是否需要更新 |
| 打开 OpenCode | 使用当前目标程序和启动目录打开 OpenCode |
| 查看备份 | 打开当前版本的原版备份目录 |
| 独立汉化版 | 在用户目录创建或更新一份单独的汉化程序 |

阶段进度和日志会显示当前操作。处理期间操作按钮会暂时锁定，完成后恢复。

### 关闭后台服务

关闭终端窗口后，如果程序仍被后台服务占用，可在退出相关会话后执行以下命令。

~~~powershell
opencode service stop
~~~

然后重新执行注入或恢复。原地注入完成后，指向该 opencode.exe 的原有启动入口即可使用中文界面。

### 使用独立汉化版

点击 **独立汉化版** 后，工具会准备用户目录中的副本，并把窗口中的目标切换到该副本。随后点击 **打开 OpenCode** 使用。

独立副本仍会读取平常的 OpenCode 配置、账号和会话数据。它不会创建独立的账号或数据环境。

## 汉化范围

目前覆盖以下内置界面和常用操作。

- 终端首页、命令面板和斜杠命令说明，包括 /goal、/init、/review。
- 模型与代理选择、代理说明、推理强度、收藏和集成入口。
- 认证方式、API 密钥输入、表单选项和常见校验错误。
- 设置分类、设置说明、选项值和主题选择。
- 会话列表、筛选、重命名、时间线、工作树和导出。
- 权限请求、始终允许确认、拒绝原因和问题表单。
- 差异查看、MCP、插件、技能说明和状态提示。
- 版本亮点、用量统计、帮助正文及 CLI 子命令和参数说明。

实现以界面显示处的文本替换为主。命令参数、配置键、模型标识和认证字段的值继续按 OpenCode 原有格式传递。

部分供应商返回的动态文案和第三方插件内容可能仍为英文。真实账号登录成功后的所有分支尚未逐项验证。

## 备份、日志与恢复

本机状态保存在用户目录中。

~~~text
%USERPROFILE%\OpencodeChinesePortable\
├─ backup\
│  └─ <原版 SHA-256>\
│     └─ opencode.exe
├─ bin\
│  └─ opencode.exe
├─ logs\
│  ├─ tool.log
│  └─ launcher.log
└─ ui-settings.json
~~~

| 路径 | 内容 |
| --- | --- |
| backup | 按原版文件指纹保存的恢复备份 |
| bin | 独立汉化版程序，创建独立副本后生成 |
| logs/tool.log | 窗口操作和阶段日志 |
| logs/launcher.log | 图形启动器发生异常时记录的错误 |
| ui-settings.json | 上次选择的程序路径和启动目录 |

恢复前会核对备份指纹。请保留当前版本的原版备份，以便使用 **还原原版**。

## 版本更新

已经安装旧版汉化时，可以再次点击 **一键注入中文**。对于工具能够识别的旧补丁，程序会从已验证的英文备份生成当前汉化版本。

OpenCode 官方更新可能替换可执行文件。工具遇到未知文件指纹时会停止写入，需要先为新发行文件完成适配。

## 命令行用法

在工具目录中运行以下命令。参数中的路径应替换为实际程序路径。

~~~powershell
# 检查指定程序
node .\patch.cjs status "D:\OpenCodeCLI\node_modules\@opencode\cli\bin\opencode.exe"

# 注入中文
node .\patch.cjs apply "D:\OpenCodeCLI\node_modules\@opencode\cli\bin\opencode.exe"

# 还原英文原版
node .\patch.cjs restore "D:\OpenCodeCLI\node_modules\@opencode\cli\bin\opencode.exe"
~~~

省略程序路径时，以上操作会使用用户目录中的独立副本。

~~~powershell
node .\patch.cjs status
~~~

## 源码与构建

| 文件 | 用途 |
| --- | --- |
| 启动工具.vbs | 图形工具入口，优先启动同目录下的 EXE |
| OpenCodeZhCNTool.exe | 随仓库提供的图形启动器 |
| launcher.cs | 启动器源码，负责窗口唤起和单实例控制 |
| tool.ps1 | 图形界面、自动检测、异步操作、进度和日志 |
| patch.cjs | 目标识别、备份、注入、验证和恢复 |
| bundle.cjs | 处理当前适配版本中的 Bun 模块资源 |
| translations.json | 基础译文 |
| translations-extra.json | 扩展界面和帮助译文 |
| translations-menus.json | 动态菜单、认证方式和表单等显示译文 |
| profiles.json | 支持的原版及汉化指纹、替换规则和历史补丁信息 |
| build-profile.cjs | 从对应的英文发行文件生成补丁配置 |
| build-launcher.ps1 | 编译图形启动器 |

### 编译图形启动器

先关闭工具窗口，再在仓库目录执行以下命令。

~~~powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\build-launcher.ps1
~~~

脚本使用 Windows 上的 .NET Framework C# 编译器和 Windows PowerShell 程序集，生成 OpenCodeZhCNTool.exe。

### 修改译文

修改译文或显示规则后，使用当前适配版本的英文原版重新生成 profiles.json。

~~~powershell
node .\build-profile.cjs "C:\path\to\original\opencode.exe"
~~~

生成器会核对原版指纹。适配其他版本还需要核对模块布局、更新规则并重新验证。

## 常见问题

| 现象 | 处理方式 |
| --- | --- |
| 双击 VBS 没有打开工具 | 直接运行 OpenCodeZhCNTool.exe，并检查 logs/launcher.log |
| 提示找不到 Node.js | 安装 Node.js 22 或更新版本，重新打开工具并确认 node.exe 可通过 PATH 找到 |
| 自动检测没有找到程序 | 用“选择程序”指定安装目录中的 opencode.exe |
| 提示发行包暂不支持 | 检查版本、架构和文件来源，并核对 profiles.json 中支持的指纹 |
| 提示文件正在使用或没有权限 | 退出相关 OpenCode 会话，停止后台服务，并确认目标目录具有写权限 |
| 提示已有汉化操作在进行 | 等待其他工具操作完成。若上次被强制中断，确认没有操作运行后再清理目标目录中的 .opencode-zh.lock |
| 官方升级后界面恢复英文 | 检查新发行文件是否已有适配的补丁 |
| 恢复时提示找不到备份 | 检查用户目录下对应原版指纹的 backup 文件夹 |

## 验证记录

在 Windows 本机完成过 50 个终端界面状态的检查，包含主菜单、模型与代理选择、认证方式、设置、会话、导出、权限确认和问题表单。

也完成过 VBS 正常启动、窗口单实例唤起、图形界面注入与恢复、CLI 中文帮助、表单校验提示，以及恢复后的原版 SHA-256 校验。

项目针对 OpenCode CLI 的界面资源进行适配，相关上游项目见 [OpenCode](https://github.com/anomalyco/opencode)。
