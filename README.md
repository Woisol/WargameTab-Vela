# Wargame Tab Watch

<img src="src/common/images/logo.png" style="display: block; height: 200px; margin: 1rem auto;" />

watch 是 Wargame Tab 的 Vela OS 手表端应用，面向真人 CS / Wargame 场景，提供战斗中 K/D 记录、撤销、历史、单局复盘、AOD 和本地设置。

手表端是记录源。已完成对局可以通过 system.interconnect 推送到 client；云端存储、录音和自动识别 D 不在当前范围内。

## 功能现状

- 战斗主页：点击开始创建本局，左右区域分别记录 K / D，中间区域展示时间、时长、K/D、撤销入口和更多入口。
- 触发方式：设置中支持长按、点击和滑动三种模式，默认长按。
- 记录修正：Undo 浮层支持减少 K、撤销最近一次操作、减少 D。
- 停止本局：结束前显示确认框，确认后写入本地历史。
- 历史战绩：读取本地真实记录，展示日期、同步状态、K、D 和 K/D；支持滑动露出删除操作，并在删除前二次确认。
- 单局复盘：展示真实单局汇总、时间范围、总时长、K/D 时间线和事件列表。
- 设置：支持触发方式、K 震动预设、D 震动预设、AOD、视觉模式和互联调试。
- AOD：战斗页闲置后进入低亮战绩视图，展示当前时间和 K / D 汇总，点击唤醒。
- 国际化：用户可见文案从 src/i18n/zh-CN.json、src/i18n/en.json 和 defaults.json 读取。
- 手机同步：应用启动时初始化 interconnect；已完成记录可被 client 请求并在收到 ACK 后标记为 synced。

自动记录 D 当前不做，也没有在设置中暴露该能力。

## 页面与路由

manifest.json 当前注册：

| 路由                  | 页面            | 作用                                |
| --------------------- | --------------- | ----------------------------------- |
| pages/index           | index           | 战斗主页、K/D 触控、Undo、More、AOD |
| pages/history         | history         | 历史列表、详情入口、滑动删除        |
| pages/review          | review          | 单局复盘和同步操作                  |
| pages/settings        | settings        | 设置主页                            |
| pages/settings-option | settings-option | 通用二级设置选项页                  |

入口为 pages/index。页面返回统一使用 src/common/scripts/navigation.js 的右滑判断和 router.back。

## 开发环境

- Node.js：package.json 声明 >=8.10。
- Vela / AIoT 工具链：本地需要能运行 aiot 命令。
- 包管理：仓库包含 pnpm-lock.yaml，当前 package scripts 使用 npm。

首次安装：

~~~text
cd watch
npm install
~~~

## 常用命令

在 watch 目录执行：

~~~text
npm test
npm run lint
npm run build
npm run start
npm run release
~~~

命令说明：

- npm test：运行 test/session.test.js，覆盖纯业务、页面模型、同步协议和设置归一化。
- npm run lint：对 src 下 .ux 和 .js 执行 ESLint 修复。
- npm run build：使用 aiot build 构建 Vela RPK。
- npm run start：启动 AIoT 开发监听。
- npm run release：执行 aiot release 生成发布产物。

AIoT IDE 或调试器崩溃后可能锁住 build 或父级临时目录，导致日志中出现 build success 但最后因 EPERM / EBUSY 清理失败退出。优先关闭 AIoT IDE 以及残留 node / AIoT 进程后重试。

## 系统能力

manifest.json 当前声明：

- system.router：页面跳转和返回。
- system.storage：当前局、历史和设置的本地持久化。
- system.vibrator：K / D 操作震动反馈。
- system.interconnect：与手机端交换同步消息。
- system.prompt：同步诊断和 Toast 提示。

## 本地数据

主要 storage key：

- wargame_current_session：未结束的当前局。
- wargame_history：已结束的历史记录数组。
- wargame_selected_session：历史页进入复盘页时选中的 session id。
- wargame_settings：触发方式、震动预设、AOD、视觉模式和互联调试。

单局数据的核心结构由 src/common/scripts/session.js 维护：

~~~json
{
  "sessionId": "session_xxx",
  "startTime": 1752057600000,
  "endTime": 0,
  "status": "ongoing",
  "summary": {
    "kills": 0,
    "deaths": 0
  },
  "events": [
    {
      "eventId": "event_xxx",
      "type": "kill",
      "time": 5,
      "meta": {
        "actionSource": "manual"
      }
    }
  ]
}
~~~

time 是相对本局开始时间的秒数。status 主要使用 ongoing、finished 和同步后的 synced。

## 手机互联同步

同步代码位于 src/common/scripts/interconnect-session-sync.js 和 session-sync-protocol.js。

同步规则：

- 只导出 status 为 finished、包含有效 sessionId、summary 和 events 的记录。
- 协议版本为 1。
- 推送消息 type 为 wargame.sessions.push。
- Client 返回 type 为 wargame.sessions.ack 的 ACK，并携带 ackMessageId 和 sessionIds。
- 收到 ACK 后，Watch 将对应 finished 记录更新为 synced。
- 当前同步以手机主动请求为主；Watch 应用启动时初始化 interconnect 运行时并等待请求。
- 同步失败不会删除手表本地历史，页面会保留诊断状态。

互联调试开关位于设置页。开启后会写入诊断日志，并对标记为 Toast 的节点显示提示；关闭后仍保留必要日志。

## 目录结构

~~~text
watch/
├─ package.json
├─ pnpm-lock.yaml
├─ src/
│  ├─ app.ux
│  ├─ manifest.json
│  ├─ config-watch.json
│  ├─ components/                    # 显式 props + 事件的 Vela 组件
│  │  ├─ action-overlay.ux
│  │  ├─ confirm-dialog.ux
│  │  ├─ icon-action.ux
│  │  └─ title-bar.ux
│  ├─ pages/
│  │  ├─ index/                      # 战斗主页
│  │  ├─ history/                    # 历史列表和滑动删除
│  │  ├─ review/                     # 单局复盘和同步
│  │  ├─ settings/                   # 设置主页
│  │  └─ settings-option/            # 二级设置选项
│  ├─ common/
│  │  ├─ scripts/
│  │  │  ├─ session.js
│  │  │  ├─ history-page.js
│  │  │  ├─ review-page.js
│  │  │  ├─ option-page.js
│  │  │  ├─ navigation.js
│  │  │  ├─ design.js
│  │  │  ├─ prompt.js
│  │  │  ├─ interconnect-session-sync.js
│  │  │  └─ session-sync-protocol.js
│  │  ├─ constants/
│  │  │  ├─ settings.js
│  │  │  └─ design.js
│  │  ├─ styles.css
│  │  └─ images/
│  │     ├─ icons/
│  │     └─ logo.png
│  └─ i18n/
│     ├─ zh-CN.json
│     ├─ en.json
│     └─ defaults.json
└─ test/
   └─ session.test.js
~~~

## 开发约定

- 修改 watch 前先阅读根目录 AGENTS.md 和 AGENTS.watch.md。
- 页面用户可见文案优先写入 src/i18n/*.json；不要在 .ux 或 helper 中新增硬编码文案。
- 业务和展示计算优先放在 src/common/scripts/*.js，并在 test/session.test.js 中补充纯逻辑测试。
- 页面共享的 padding、颜色、圆角和运行时 style 字符串优先复用 common/constants/design.js、common/scripts/design.js 和 common/styles.css。
- 图标优先使用 common/images/icons 下的设计资源。
- 组件拆分优先使用显式 props 和显式事件，不要优先引入依赖 slot 的通用 wrapper。
- Vela 列表使用 list / list-item；复杂页面长内容使用 scroll scroll-y="true"。
- 绝对定位浮层的父节点必须有 position: relative；时间线 marker 和浮层定位优先使用明确的 px 计算。
- 危险操作必须保留确认流程。
- 历史、复盘和同步必须读取本地真实数据，不使用静态设计稿数字。
- 不要在设置中加入自动记录 D；该能力不在当前业务范围。

## 参考文档

- ../AGENTS.md：通用代码、测试和风险控制约定。
- ../AGENTS.watch.md：Vela 结构、UI 适配、组件化和业务边界。
- ../project/design/watch-design.md：设计背景。
- ../project/implement/watch-app-implementation-plan.md：实现记录。
- ../project/design/interconnect-watch-phone-sync.md：手机互联同步设计。
- ../project/implement/interconnect-watch-phone-sync-followup-plan.md：同步后续实现记录。
- Vela 快应用官方文档：https://iot.mi.com/vela/quickapp

