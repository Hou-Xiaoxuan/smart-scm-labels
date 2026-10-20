# Smart SCM Labels

在 VS Code 原生源代码管理（SCM）列表中，折叠重复的目录与长文件名前缀，让有限宽度优先展示文件名。适合 Java 等目录深、文件名长的项目，无需新建独立视图。

当前版本：**0.3.0 · 实验性扩展**。

> 本扩展通过修改 VS Code Workbench 文件实现自定义标签和行高，不是纯公开 API 扩展。安装 VSIX 与安装补丁是两个步骤。补丁可能触发 VS Code 的“安装似乎已损坏 / Unsupported”提示；本项目不关闭完整性检查、不改写校验记录。卸载扩展前必须先移除补丁。

## 功能

- 仅在 SCM 列表模式启用，按目录路径和文件名自然排序。
- 按仓库和 SCM 分组分别计算，已暂存与未暂存文件不混合。
- 自动选择公共目录组，避免新增一个公共前缀较短的文件破坏其他组的折叠效果。
- 同目录长文件名按公共前缀及 CamelCase 边界折叠。
- 首条展示公共路径和自身内容，后续条目显示差异路径和文件名；二者在布局中独立处理。
- 宽度不足时先缩写目录，再以 `…` 标记省略的目录；文件名最后从右侧截断。文件图标对齐文件名所在行。
- 支持固定隐藏、首字母缩写、省略号和自定义文字等路径规则；条目悬浮显示完整原始路径。
- 安装并重载后可动态开关，不替换原生 Diff、Stage、Unstage、右键及键盘事件处理。

## 兼容性

| 项目 | 当前范围 |
| --- | --- |
| VSIX 安装范围 | VS Code `^1.100.0`，即 1.100.0 起的 1.x 稳定版本范围 |
| 已知构建基准 | macOS 上特定的 VS Code 1.142.0 Workbench 构建 |
| 其他构建 | 结构与语法预检通过后才允许安装补丁，标记为实验兼容 |
| Web | 不支持 |
| Windows、Linux、Remote/WSL | 未完成真实环境验收 |

**允许安装 VSIX 不等于 Workbench 补丁兼容。** 补丁仍依赖已知的压缩符号和内部结构。版本变化导致注入点缺失、重复或菜单依赖变化时，会拒绝安装；没有“强制跳过检查”选项。

安装前检查六个注入点、菜单依赖上下文及匹配唯一性，再检查生成模块的语法。检查失败不会写入应用文件。预检不能发现全部运行时行为差异，也不是其他扩展冲突的全面检测器。

兼容性报告中的等级：

- `verified-build`：原文件版本和哈希与已知基准一致；不代表当前插件全部功能均已完成窗口验收。
- `experimental-structure-match`：其他构建通过结构和语法检查，仍需实际窗口验证。

## 安装与启用

1. 获取 `smart-scm-labels-0.3.0.vsix`，或按下文从源码打包。
2. 在命令面板执行 `Extensions: Install from VSIX...`，选择安装包。
3. 执行 `Smart SCM: Check Compatibility`，查看 **Smart SCM Labels** 输出面板。若失败，保留错误信息，不手动删改检查逻辑。
4. 执行 `Smart SCM: Install Patch`。应用目录必须可写；权限不足会报错，不会自动提权或修改目录权限。
5. 执行 `Developer: Reload Window`，加载补丁。
6. 将 SCM 切为列表模式，在 `...` 菜单中启用 **Smart SCM: 智能文件名折叠**，也可执行 `Smart SCM: Toggle Labels`。

菜单项在已知默认布局中位于“以树形查看”下方，仅在列表模式且有仓库时显示。用户自定义菜单或其他扩展可能影响相邻位置。该菜单名称沿用早期版本，实际同时控制路径和文件名折叠。

初次启用默认关闭。安装补丁后的开关和显示配置变更无需重载；安装、移除或更换 Workbench 补丁需要重载。

| 命令 | 用途 |
| --- | --- |
| `Smart SCM: Check Compatibility` | 只读结构和语法检查，不安装补丁 |
| `Smart SCM: Patch Status` | 查看磁盘状态、文件位置及当前窗口菜单注册状态 |
| `Smart SCM: Install Patch` | 备份并安装补丁 |
| `Smart SCM: Remove Patch` | 验证后恢复原始 Workbench 文件，保留备份 |
| `Smart SCM: Toggle Labels` | 在列表模式切换增强显示 |

`Patch Status` 中 `patched: true` 只表示磁盘文件已打补丁；`runtimeCommandRegistered: true` 表示当前窗口已注册补丁菜单，不等于所有功能已验收。

## 配置

在 VS Code 的 `settings.json` 中配置。配置名、规则字段和 `mode` 可选值均提供悬浮说明及输入补全。

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `smartScm.enabled` | `false` | 启用增强显示，仅列表模式生效 |
| `smartScm.minPrefixLength` | `12` | 公共文件名前缀最小长度，范围 4–128；也用于公共路径分组的长度门槛 |
| `smartScm.maxDisplayLines` | `2` | 显示层数预算，范围 1–10 |
| `smartScm.pathRules` | `[]` | 按顺序匹配的路径显示规则 |
| `smartScm.hiddenCommonDirectories` | `[]` | 已弃用的旧版公共目录隐藏配置 |

`maxDisplayLines: 2` 时，路径组首条最多两行：公共路径与自身内容各一行；继承公共路径的后续文件只占一行。设为 1 时不显示公共路径标题，完整路径仍可悬浮查看。

路径规则支持用户、工作区和文件夹设置；文件夹优先，数组整体覆盖、不合并。其余设置为窗口级配置。命令面板中的 `Toggle Labels` 写入用户设置；若工作区显式覆盖 `enabled`，该命令的切换效果可能被覆盖。

### 路径匹配与四种显示方式

```json
{
  "smartScm.maxDisplayLines": 2,
  "smartScm.pathRules": [
    {
      "pattern": "app/src/test/java",
      "mode": "replace",
      "replacement": "测试"
    },
    {
      "pattern": "app/src/main/java",
      "mode": "ellipsis"
    },
    {
      "pattern": "tools/src/main/java",
      "mode": "abbreviate"
    },
    {
      "pattern": "generated",
      "mode": "hide"
    }
  ]
}
```

| 模式 | 处理方式 | 示例 |
| --- | --- | --- |
| `hide` | 彻底移除匹配的前缀，不加标记 | `generated/api/Client.java` → `api/Client.java` |
| `abbreviate` | 匹配的每级目录固定保留首字符 | `tools/src/main/java/Task.java` → `t/s/m/j/Task.java` |
| `ellipsis` | 整段匹配前缀固定替换为 `…` | `app/src/main/java/Main.java` → `…/Main.java` |
| `replace` | 整段匹配前缀替换为指定文本 | `app/src/test/java/MainTest.java` → `测试/MainTest.java` |

以上示例是规则转换结果，最终显示还会受公共分组、面板宽度和行数预算影响。

匹配规则：

- 从**仓库相对路径的开头**匹配完整目录段，区分大小写，不匹配文件名。
- `*` 匹配一级目录；`**` 贪婪匹配零到多级目录。不支持 `foo*` 等部分目录名通配，也不是正则表达式。
- 按数组顺序取第一条有效且匹配的规则，只转换一次，不叠加后续规则。
- `replace` 必须提供非空、无控制字符的单行 `replacement`，按纯文本显示，不做变量替换。
- 无效规则跳过。`pathRules` 非空时停用旧 `hiddenCommonDirectories`，即使新规则未匹配任何文件；为空时保留旧行为。

**`**` 也属于被处理的前缀。** 例如 `**/com/example` 匹配 `app/src/main/java/com/example/service/Api.java` 时，匹配部分是整个 `app/src/main/java/com/example`。使用 `ellipsis` 后得到 `…/service/Api.java`，不会保留前面的 `app/src/main/java`。当前不支持“保留起始目录，只替换中间片段”的捕获组替换。

规则在有仓库根 URI、可用标签宽度不少于 48px 时参与布局，适用于分组文件和单独文件。匹配后的自定义文字、固定缩写和省略号不会被自动目录压缩再次改写；空间仍不足时可能视觉截断。

旧 `hiddenCommonDirectories` 会从公共路径中删除连续匹配的目录段，不支持通配符，与新规则的起点匹配语义不同。新用户建议仅使用 `pathRules`。

## 更新、卸载与恢复

### 日常卸载或更新

- **卸载扩展前**：执行 `Smart SCM: Remove Patch` → 重载窗口 → 卸载 VSIX。仅关闭功能或卸载 VSIX 都不会撤销磁盘补丁。
- **更新 VS Code 前**：先移除补丁，退出编辑器，再更新。更新后重新检查兼容性；不要把旧构建的备份覆盖到新版本。
- **更新本扩展时**：安装新版 VSIX 不会自动更换已注入的运行时代码。若新版修改了 Workbench 补丁，需要先移除旧补丁、重载，再安装新补丁。

恢复后应用旁的 `.smart-scm-original` 与 `.smart-scm.json` 故意保留。重新安装前，应先核对当前文件哈希等于对应回执中的 `original`，再将这两个文件移到独立归档目录；否则安装器会提示已有恢复文件并拒绝覆盖。没有自动归档或自动升级补丁功能。

### 备份与命令行恢复

安装时备份包含两份：

- 应用文件旁的 `workbench.desktop.main.js.smart-scm-original` 与 `workbench.desktop.main.js.smart-scm.json`。
- 扩展 `globalStorage` 下的 `recovery/<实际版本>/<补丁哈希前12位>/`，包含 `original.js` 和 `receipt.json`。

备份记录实际版本、原始哈希与补丁哈希，创建完成后才原子替换目标文件。首次使用建议确认应用外备份位置并另行保存，尤其是在卸载扩展前。

若编辑器无法启动，可用 Node.js 从本项目根目录恢复。下面是 macOS 默认安装路径示例；其他安装位置需替换为包含 `package.json` 和 `out/` 的 VS Code `appRoot`，不是业务项目目录。

```sh
node scripts/recover.js status '/Applications/Visual Studio Code.app/Contents/Resources/app'
node scripts/recover.js remove '/Applications/Visual Studio Code.app/Contents/Resources/app'
```

如果应用旁的备份已丢失，第三个参数指定应用外的恢复目录：

```sh
node scripts/recover.js remove '<appRoot>' '<recovery目录，内含original.js和receipt.json>'
```

恢复会核对版本、原始备份和当前目标哈希。版本变化、备份损坏或目标被其他工具修改时拒绝恢复；不要删掉检查强行覆盖。可以重新安装官方 VS Code 恢复应用文件。恢复后重新加载或启动编辑器。

## 开发与验证

无需安装 npm 依赖，开发和脚本运行使用 Node.js 18+、Python 3。所有命令从项目根目录执行。

```sh
npm test
npm run package
```

产物为 `dist/smart-scm-labels-0.3.0.vsix`。这是本地打包的 VSIX，不包含 Marketplace 签名；打包不会自动发布、安装或修改 VS Code。

默认测试不包含真实 Workbench fixture 的三项安装/恢复测试，这三项会跳过。完整测试需提供**未打补丁的已知 1.142.0 构建副本**，勿将当前已打补丁的应用当作原始 fixture：

```sh
SMART_SCM_TEST_APP='/path/to/pristine/resources/app' npm test
```

真实 bundle 测试只修改临时副本，不修改指定 fixture。只读检查任意候选构建可使用：

```sh
node scripts/check-build.js '/path/to/resources/app'
```

该检查也支持原始备份和回执完整的已打补丁应用，不执行生成后的 Workbench 代码。

### 已验证与已知限制

0.3.0 的 29 项自动测试通过，覆盖布局、规则匹配、模拟 DOM 生命周期、模拟不同版本/哈希、注入冲突、语法错误、篡改及回滚拒绝。**模拟版本测试不等于真实多版本适配。**

早期 0.1.2 在 macOS / VS Code 1.142.0 测试窗口验收过菜单、开关、树模式显隐、快速滚动、Stage/Unstage、Diff 和基本键盘导航。后续路径规则与图标布局更新没有完成同等完整的真实窗口验收，不将早期结果计作当前版本全量通过。

其他限制：

- 固定按 22px 单行高度布局，不支持其他扩展强制修改 SCM 行高。
- 极窄标签区（不足 48px）回到原生显示；分组首条滚出视口时，后续条目不重复展示公共标题，可悬浮查看完整路径。
- 同目录的文件名前缀按整组计算，不对该目录内的文件名子集另做聚类。
- 自定义视觉标签不重绘原生模糊搜索高亮；原生可访问名称保留，未完成完整辅助功能验收。
- 多仓库、多选、重命名/删除、不同主题/DPI、远程、多窗口同步及超大变更集仍需实机验证。
- 不自动监测所有运行时冲突、不自动撤销补丁，也不在 VS Code 更新后自动重新应用。

## 分享与许可证

源码使用 MIT 许可证，见 [LICENSE](LICENSE)。

公开仓库可包含 `lib/`、`test/`、`scripts/`、`extension.js`、`package.json`、`README.md`、`LICENSE` 和 `.gitignore`。VSIX 可作为 Release 附件上传。不要上传 `recovery/` 中的 VS Code 原始程序或机器备份；本地 `docs/` 验收记录可能含机器路径，公开前应单独检查。

网页手动上传不会自动遵循 `.gitignore`，请手动筛选文件。本项目不会自动上传源码、备份或业务文件。
