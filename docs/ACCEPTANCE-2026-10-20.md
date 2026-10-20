# 本机验收记录 — 2026-10-20

环境：macOS，本机 VS Code 1.142.0，Smart SCM Labels 0.1.2，原生 SCM。验收仓库 `/private/tmp/smart-scm-labels-acceptance`，60 个目录、每目录 5 个修改的 Java 文件，另有一个未跟踪设置文件。未对业务仓库执行 Git 写操作。

## 排查结论

开始时安装版已从 1.141.2 更新到 1.142.0，磁盘为原始 bundle，旧插件未安装。旧适配器会拒绝此构建。按当前 bundle 核对并更新 renderer/delegate/action 注册内部符号和精确 hash，加入运行时命令注册诊断。

安装新补丁及 VSIX 后打开新的验收窗口，`Smart SCM: Patch Status` 显示 `runtimeCommandRegistered: true`。菜单与折叠立即生效。本次没有重启业务窗口，没有修改 bootstrap/HTML、清缓存、关闭完整性校验或绕过 DevTools 粘贴保护。此前旧窗口未生效的历史根因未能复现，不能认定是缓存；目前证实新版正确加载并运行。

## 实际验收

- SCM 更改视图的 overflow 菜单第一项“以树形式查看”，第二项“Smart SCM: 智能文件名折叠”。
- 点击开关后：共同前缀 CpActivityRecommendation 在首条第一行，Service.java 在第二行；后续显示 ServiceFactory.java 等后缀。
- 关闭后恢复完整原生文件名和单行行高，再从菜单开启即时恢复折叠，无重载。
- 快速滚动经过中间 feature18/19 到末尾 feature59，再快速回顶；可见行未出现重复前缀、错行或重叠。此为人工视觉验收，不是帧率基准。
- 原生右键暂存 feature00/Service.java；Git 索引只出现该目标文件；暂存分组显示 1，未暂存显示 300。取消暂存后回到 301，最终 Git 索引为空。
- 切为树模式：菜单显示“以列表形式查看”，智能折叠项消失；回列表恢复开关状态。
- 点击首条打开对应原生 Diff；Down + Enter 打开下一条 ServiceFactory.java 的 Diff。
- 8 项自动测试通过，真实 bundle 语法检查通过；真实 bundle 临时副本验证内外备份、恢复幂等、篡改/升级拒绝。删除副本的应用内备份后仍能从应用外备份恢复原始字节。

未实机覆盖：多仓库并列、重命名/删除、多选、极端面板宽度、其他 DPI/主题、远程、多窗口配置同步。原生 hover 链路保留，但本轮没有单独完成悬停截图验收。

## 应用外回滚

工作区 `recovery/1.142.0/b68d40ed3dd4/` 保留 original.js 和 receipt.json，不随应用升级被替换。原始 SHA-256：

`74de4ceb93610658c5eb15b64b228d085f25c9c95d6ec8b002f791df7be4614c`

已安装补丁 SHA-256：

`b68d40ed3dd48ca653efbc32cbd16225a1d87f4c8937313acbff716ec63a6936`

常规恢复：命令面板执行 Smart SCM: Remove Patch，重载后再卸载扩展。

应急恢复：在本项目 smart-scm-labels 目录运行：

```sh
node scripts/recover.js remove '/Applications/Visual Studio Code.app/Contents/Resources/app' './recovery/1.142.0/b68d40ed3dd4'
```

恢复工具严格核对版本对应 hash；VS Code 更新后不要用旧备份覆盖新程序。备份及收据保留。修改 Workbench 会出现“安装似乎损坏”提示，这是已知限制，没有关闭校验来隐藏它。
