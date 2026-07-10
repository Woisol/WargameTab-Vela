# Wargame Tab Watch

`watch` 是 Wargame Tab 的 Vela OS 手表端应用。它面向真人 CS / Wargame 场景，在战斗中提供可盲操的 K / D 记录、撤销、历史记录、单局复盘、AOD 展示和本地设置。

当前目录只实现手表端能力；手机端同步、云端存储、录音和自动识别 D 不在本目录现阶段范围内。

## 功能现状

- 战斗主页：点击开始后创建本局记录，左右区域分别记录 K / D，中间区域展示时间、时长、K/D 比、撤销入口和更多入口。
- 记录修正：Undo 浮层支持减少 K、撤销最近一次操作、减少 D。
- 停止本局：结束前弹出确认框，确认后把本局写入本地历史。
- 历史战绩：读取本地真实记录，展示日期、同步状态、K、D 和 K/D；支持滑动露出删除操作，并在删除前二次确认。
- 单局复盘：展示真实单局汇总、时间范围、总时长、K/D 时间线和事件列表。
- 设置：支持触发方式、K 震动、D 震动、AOD 开关等本地设置。
- AOD：应用内低亮战绩视图，开启后在战斗页闲置时显示当前时间和 K / D 汇总，点击唤醒。
- 国际化：用户可见文案默认走 `src/i18n/*.json`，页面和 helper 中不直接硬编码文案。

## 目录结构

```text
watch/
├─ src/
│  ├─ app.ux                         # 应用生命周期入口
│  ├─ manifest.json                  # Vela 路由、权限和应用配置
│  ├─ config-watch.json              # 手表端构建配置
│  ├─ components/                    # 显式 props + 事件的 Vela 组件
│  │  ├─ action-overlay.ux
│  │  ├─ confirm-dialog.ux
│  │  ├─ icon-action.ux
│  │  └─ title-bar.ux
│  ├─ pages/
│  │  ├─ index/                      # 战斗主页、K/D 触控、Undo/More、AOD
│  │  ├─ history/                    # 历史列表和滑动删除
│  │  ├─ review/                     # 单局复盘
│  │  ├─ settings/                   # 设置主页
│  │  └─ settings-option/            # 通用二级设置选项页
│  ├─ common/
│  │  ├─ session.js                  # 可测试的 session、设置、展示数据 helper
│  │  ├─ history-page.js             # 历史列表展示模型
│  │  ├─ review-page.js              # 复盘页展示模型
│  │  ├─ option-page.js              # 二级设置页模型和保存值生成
│  │  ├─ navigation.js               # 右滑返回、左滑删除等手势判断
│  │  ├─ design.js                   # 设计常量访问 helper
│  │  ├─ constants/                  # 设置项和设计常量
│  │  ├─ styles.css                  # 跨页面通用样式
│  │  └─ *.png                       # 设计稿提供的图标和位图资源
│  └─ i18n/
│     ├─ zh-CN.json
│     ├─ en.json
│     └─ defaults.json
└─ test/
   └─ session.test.js                # Node 脚本测试，覆盖纯业务 helper
```

## 开发环境

- Node.js：`package.json` 声明 `>=8.10`。
- Vela / AIoT 工具链：脚本依赖 `aiot-toolkit`，本地需要能运行 `aiot` 命令。
- 包管理：仓库内有 `pnpm-lock.yaml`，但当前脚本按 `npm` 使用；如需切换包管理器，请保持 lockfile 和团队约定一致。

首次安装：

```bash
cd watch
npm install
```

## 常用命令

在 `watch` 目录执行：

```bash
npm test
```

运行 `test/session.test.js`，覆盖 session 创建、K/D 事件、撤销、扣减、复盘时间线、设置归一化、页面结构约束等纯逻辑。

```bash
npm run build
```

使用 `aiot build` 构建 Vela RPK。AIoT IDE 或调试器崩溃后可能锁住 `build` 或父级临时目录，导致日志中已经出现 `build success`，但最后因 `EPERM` / `EBUSY` 清理失败退出；这种情况优先关闭 AIoT IDE 和残留 node / AIoT 进程后重试。

```bash
npm run start
```

启动 AIoT 开发监听。

```bash
npm run release
```

执行 `aiot release` 生成发布产物。

```bash
npm run lint
```

对 `src/` 下 `.ux` 和 `.js` 文件执行 ESLint 修复。

## 路由与权限

入口页面是 `pages/index`。`manifest.json` 当前注册的页面：

- `pages/index`：战斗主页
- `pages/history`：历史战绩
- `pages/review`：单局复盘
- `pages/settings`：设置主页
- `pages/settings-option`：通用设置选项页

当前声明的系统能力：

- `system.router`：页面跳转和返回
- `system.storage`：本地保存当前局、历史和设置
- `system.vibrator`：K / D 操作震动反馈

## 本地数据

主要存储 key：

- `wargame_current_session`：未结束的当前局。
- `wargame_history`：已结束的历史记录数组。
- `wargame_selected_session`：历史页进入复盘页时选中的 session id。
- `wargame_settings`：触发方式、震动预设、AOD 等设置。

单局数据的核心结构由 `src/common/session.js` 维护：

```js
{
  sessionId: "session_xxx",
  startTime: 1752057600000,
  endTime: 0,
  status: "ongoing",
  summary: {
    kills: 0,
    deaths: 0
  },
  events: [
    {
      eventId: "event_xxx",
      type: "kill",
      time: 5,
      meta: {
        actionSource: "manual"
      }
    }
  ]
}
```

`time` 是相对开局的秒数。`status` 当前主要使用 `ongoing`、`finished` 和展示层兼容的 `synced`。

## 开发约定

- 修改 `/watch` 前先阅读根目录 `AGENTS.md` 和 `AGENTS.watch.md`。
- 页面用户可见文案优先写入 `src/i18n/*.json`，不要在 `.ux` 或 helper 中硬编码。
- 业务和展示计算优先放在 `src/common/*.js`，并在 `test/session.test.js` 中补充覆盖；`.ux` 保持页面结构、事件和 Vela 交互。
- 页面共享的 padding、颜色、圆角和运行时 style 字符串优先复用 `src/common/constants/design.js`、`src/common/design.js` 和 `src/common/styles.css`。
- 图标资源优先使用 `src/common/*.png` 中的设计稿资源；缺资源时先补资源或说明缺失，不要随手自绘替代。
- 组件拆分优先使用显式 props 和显式事件，不要优先做依赖 `<slot>` 的通用 wrapper。
- 自定义组件内避免动态 `class="{{ ... }}"` / `style="{{ ... }}"` 控制关键文本或布局；需要差异样式时优先由页面传入稳定文本和少量稳定 props。
- Vela 页面适配优先用 `flex: 1`、`width: 100%`、明确高度的 `list` / `scroll` 和 `@media screen and (shape: circle)` 安全区处理，不要用固定 `500px` 页面宽度还原设计稿。
- 停止本局、删除历史等危险操作必须保留确认流程。
- 历史和复盘必须读取本地真实数据，不使用静态设计稿数字。

## 参考文档

- `../AGENTS.watch.md`：手表端结构、构建、UI 适配和业务边界。
- `../project/design/watch-design.md`：早期设计背景。
- `../project/implement/watch-app-implementation-plan.md`：实现任务和人工复盘记录。
- Vela 快应用官方文档：https://iot.mi.com/vela/quickapp
