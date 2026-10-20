# 当前状态：0.3.0（结构兼容分享版）

已解除整包哈希白名单，采用原有六个精确注入点 + 菜单符号上下文 + 唯一性 + 完整模块语法预检。仍依赖已知压缩符号，不保证其他实际 VS Code 版本兼容。插件引擎门槛 ^1.100.0 仅允许安装 VSIX；补丁兼容由预检决定。

新增 checkCompatibility 命令。实际版本/原始哈希写入备份回执；跨版本、篡改文件拒绝恢复，旧回执仍支持。29 项测试通过（其他版本为模拟构建），本机现有补丁只读检查为 verified-build。此次运行时文件未改动，无需更换本机 Workbench 补丁。

以下为历史记录。

# 当前状态：0.2.2（2026-10-20）

项目迁移到 `/Users/houfuzhong/workspace/smart-scm-labels`。源码、历史 VSIX 和 recovery 备份一起迁移。尚未初始化 Git 或上传远程；.gitignore 排除安装包、回滚备份、依赖与日志。

0.2.1 补齐中文设置说明、mode 可选值说明及路径规则补全模板。
0.2.2 文件图标对齐最后一行文件名；单行无偏移，关闭增强清除偏移。已安装 VSIX 和补丁，27 项测试及真实 bundle 语法检查通过；最新图标效果未完成真实窗口验收，需要重载窗口。

当前补丁 SHA-256：32a6474c250673a82e23fd6151b79e381a596045dd26e0b3e48e5ae100f1f3a9。
当前原版恢复目录：`recovery/1.142.0/32a6474c2506/`。
从项目根目录恢复（只适用于匹配的本机 VS Code 构建）：
```sh
node scripts/recover.js remove '/Applications/Visual Studio Code.app/Contents/Resources/app' './recovery/1.142.0/32a6474c2506'
```

以下为历史 0.2.0 记录，安装状态及恢复路径以以上内容为准。

# 0.2.0 路径规则已安装

新增 smartScm.pathRules（resource scope），数组顺序第一条合法匹配胜出；从仓库相对路径起点按目录段匹配，* 一级、** 贪婪零或多级，仅匹配目录。hide/abbreviate/ellipsis/replace 四种模式。replace 要求非空单行 replacement，纯文本渲染。保护替换字符串、显式省略号和固定缩写不被自动路径压缩改写（仍可能 CSS 视觉截断）。原始 URI/hover/Git 不变。

规则在分组和显示前匹配。不同规则按 signature 分桶；规则消费超过共同目录的情况下保持独立条目，避免自身目录泄漏到公共标题。单文件和宽面板也应用。pathRules 非空时停用旧 hiddenCommonDirectories；为空保留旧行为。未自动改动用户业务 settings.json，请用户使用新配置。

27 项测试通过，覆盖四模式、单独文件、anchored/glob、greedy/优先级、不同资源配置、公共/自身隔离、窄面板文字保护、运行时配置更换与原始资源 URI 传递。300 文件合成规则计算 36ms（非真实滚动基准），27 测试和生成真实 bundle 语法通过。

0.2.0 VSIX 与补丁已安装。未重载当前正在使用的业务窗口，未完成本版本真实 GUI 配置验收；需 Reload Window 加载补丁。业务 status/未暂存 diff/已暂存 diff 对原快照一致。

应用外回滚 recovery/1.142.0/188566f5bd4f/，旧版本归档 recovery/upgrade-*。
```sh
node scripts/recover.js remove '/Applications/Visual Studio Code.app/Contents/Resources/app' './recovery/1.142.0/188566f5bd4f'
```
恢复后重载窗口。
