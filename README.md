# Open code CLI 中文注入

适配官方 npm 包 `@opencode/cli@2.2.5` 的 Windows x64 发行文件。双击 **启动工具.vbs** 打开与 Cursor 工具相同布局的深色窗口，包含自动检测、阶段进度、日志、注入、恢复、状态、启动和备份入口。VBS 优先运行同目录的 OpenCodeZhCNTool.exe，重复打开会唤起已有窗口。需要 Windows Script Host、Windows PowerShell 5.1、.NET Framework 4.8 和 Node.js 22+。

- **独立汉化版**：将原版复制到 `%USERPROFILE%\OpencodeChinesePortable\bin\opencode.exe` 并注入。再点 **打开 OpenCode** 即可使用。独立的是程序文件，启动时仍读取你平常的 OpenCode 配置和会话。
- **一键注入中文**：原地汉化目标框中的可执行文件。先关闭使用该程序的终端窗口；若文件仍被后台服务占用，可在退出所有相关会话后运行原启动脚本的 `service stop`。本机默认目标是 `D:\OpenCodeCLI\node_modules\@opencode\cli\bin\opencode.exe`，注入成功后原 `opencode.cmd` 入口会使用中文界面。
- **还原原版**：对目标框中的程序恢复原文件。原版备份保存在 `%USERPROFILE%\OpencodeChinesePortable\backup\<SHA-256>\opencode.exe`。
- **启动目录**：决定新启动的 OpenCode 从哪里开始，本机默认 `D:\OpenCode`，也可以在窗口中选择其他目录。

汉化覆盖终端首页、斜杠命令说明、模型与代理选择和描述、推理强度、认证方式和输入表单、设置及选项值、会话和工作树、权限确认、问题表单及校验提示、差异与导出、MCP 和插件操作、技能说明、版本亮点、用量统计，以及 CLI 帮助和参数。部分运行时输出、服务端内容和第三方插件可能仍为英文。命令名、斜杠命令和快捷键保持原样。

程序按 SHA-256 核对官方发行文件，先备份，再验证临时汉化副本的版本和中文帮助，验证通过后替换文件。已有汉化可以直接再次点 **一键注入中文** 升级，工具会从已验证的英文原版生成新版补丁。未知版本会拒绝写入。官方更新后需重新适配，不能对新版强行套用当前补丁。

界面启动器可通过 build-launcher.ps1 从 launcher.cs 重新编译。窗口设置和日志保存在 %USERPROFILE%\OpencodeChinesePortable。

维护入口：`translations.json` 、`translations-extra.json` 和 `translations-menus.json` 保存界面、帮助和动态菜单译文；`build-profile.cjs` 用对应的原版程序生成 `profiles.json`。可用 `node patch.cjs status|apply|restore "完整路径\opencode.exe"` 操作指定文件，省略路径时操作独立副本。
