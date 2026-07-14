const assert = require("assert")
const fs = require("fs")
const path = require("path")

const session = require("../src/common/scripts/session.js")
const navigation = require("../src/common/scripts/navigation.js")
const design = require("../src/common/scripts/design.js")
const designConstants = require("../src/common/constants/design.js")
const settingConstants = require("../src/common/constants/settings.js")
const optionPage = require("../src/common/scripts/option-page.js")
const historyPage = require("../src/common/scripts/history-page.js")
const reviewPage = require("../src/common/scripts/review-page.js")
const sync = require("../src/common/scripts/session-sync-protocol.js")
const prompt = require("../src/common/scripts/prompt.js")

function runTest(name, fn) {
  try {
    fn()
    console.log("PASS " + name)
  } catch (error) {
    process.exitCode = 1
    console.error("FAIL " + name)
    console.error(error && error.stack ? error.stack : error)
  }
}

runTest("generic toast formats optional fields and safely handles prompt failures", () => {
  const messages = []
  const toast = prompt._createToast({
    showToast: function (options) {
      messages.push(options.message)
    }
  })

  toast("sync failed", "interconnect")
  toast("plain message")

  assert.deepEqual(messages, ["[interconnect] sync failed", "plain message"])
  assert.doesNotThrow(function () {
    prompt._createToast({
      showToast: function () {
        throw new Error("prompt unavailable")
      }
    })("ignored", "test")
  })
})

runTest("createSession creates an ongoing session with zero summary", () => {
  const result = session.createSession(1752057600000)

  assert.equal(result.status, "ongoing")
  assert.equal(typeof result.sessionId, "string")
  assert.ok(result.sessionId.length > 0)
  assert.equal(result.startTime, 1752057600000)
  assert.equal(result.endTime, 0)
  assert.deepEqual(result.summary, { kills: 0, deaths: 0 })
  assert.deepEqual(result.events, [])
})

runTest("addEvent records kill and death events with ids and relative seconds", () => {
  const started = session.createSession(100000)
  const afterKill = session.addEvent(started, "kill", 105200, "manual")
  const afterDeath = session.addEvent(afterKill, "death", 112000, "manual")

  assert.deepEqual(afterDeath.summary, { kills: 1, deaths: 1 })
  assert.equal(typeof afterDeath.events[0].eventId, "string")
  assert.ok(afterDeath.events[0].eventId.length > 0)
  assert.equal(typeof afterDeath.events[1].eventId, "string")
  assert.ok(afterDeath.events[1].eventId.length > 0)
  assert.deepEqual(
    afterDeath.events.map((event) => ({
      type: event.type,
      time: event.time,
      actionSource: event.meta.actionSource
    })),
    [
      { type: "kill", time: 5, actionSource: "manual" },
      { type: "death", time: 12, actionSource: "manual" }
    ]
  )
})

runTest("addEvent defaults actionSource only when omitted", () => {
  const started = session.createSession(100000)
  const omitted = session.addEvent(started, "kill", 101000)
  const emptySource = session.addEvent(started, "death", 102000, "")

  assert.equal(omitted.events[0].meta.actionSource, "manual")
  assert.equal(emptySource.events[0].meta.actionSource, "")
})

runTest("undoLast removes the latest event and updates the summary", () => {
  const started = session.createSession(100000)
  const withEvents = session.addEvent(
    session.addEvent(started, "kill", 101000, "manual"),
    "death",
    102000,
    "manual"
  )

  const result = session.undoLast(withEvents)

  assert.deepEqual(result.summary, { kills: 1, deaths: 0 })
  assert.equal(result.events.length, 1)
  assert.equal(result.events[0].type, "kill")
})

runTest("undoLast keeps an empty session safe", () => {
  const started = session.createSession(100000)
  const result = session.undoLast(started)

  assert.deepEqual(result.summary, { kills: 0, deaths: 0 })
  assert.deepEqual(result.events, [])
})

runTest("decrement removes the latest matching event and never goes below zero", () => {
  const started = session.createSession(100000)
  const withEvents = session.addEvent(
    session.addEvent(started, "kill", 101000, "manual"),
    "kill",
    102000,
    "manual"
  )

  const oneKill = session.decrement(withEvents, "kill")
  const zeroKill = session.decrement(oneKill, "kill")
  const stillZero = session.decrement(zeroKill, "kill")

  assert.deepEqual(oneKill.summary, { kills: 1, deaths: 0 })
  assert.deepEqual(zeroKill.summary, { kills: 0, deaths: 0 })
  assert.deepEqual(stillZero.summary, { kills: 0, deaths: 0 })
  assert.deepEqual(stillZero.events, [])
})

runTest("decrement removes the latest matching event from mixed events", () => {
  const started = session.createSession(100000)
  const withEvents = session.addEvent(
    session.addEvent(
      session.addEvent(started, "kill", 101000, "manual"),
      "death",
      102000,
      "manual"
    ),
    "kill",
    103000,
    "manual"
  )

  const result = session.decrement(withEvents, "kill")

  assert.deepEqual(result.summary, { kills: 1, deaths: 1 })
  assert.deepEqual(
    result.events.map((event) => event.type),
    ["kill", "death"]
  )
})

runTest("addEvent, undoLast, and decrement do not mutate input session counts", () => {
  const started = session.createSession(100000)
  const withKill = session.addEvent(started, "kill", 101000, "manual")
  const withEvents = session.addEvent(
    session.addEvent(withKill, "death", 102000, "manual"),
    "kill",
    103000,
    "manual"
  )

  session.addEvent(started, "death", 104000, "manual")
  assert.deepEqual(started.summary, { kills: 0, deaths: 0 })
  assert.equal(started.events.length, 0)

  session.undoLast(withEvents)
  assert.deepEqual(withEvents.summary, { kills: 2, deaths: 1 })
  assert.equal(withEvents.events.length, 3)

  session.decrement(withEvents, "kill")
  assert.deepEqual(withEvents.summary, { kills: 2, deaths: 1 })
  assert.equal(withEvents.events.length, 3)
})

runTest("finishSession stores end time and finished status", () => {
  const started = session.createSession(100000)
  const result = session.finishSession(started, 170000)

  assert.equal(result.status, "finished")
  assert.equal(result.endTime, 170000)
})

runTest("formatDuration and getKdRatio return display values", () => {
  assert.equal(session.formatDuration(0), "00:00")
  assert.equal(session.formatDuration(61000), "01:01")
  assert.equal(session.formatDuration(3723000), "1:02:03")
  assert.equal(session.getKdRatio({ kills: 13, deaths: 7 }), "1.86")
  assert.equal(session.getKdRatio({ kills: 3, deaths: 0 }), "3.00")
})

runTest("createReviewTimelineItems maps events to horizontal review markers", () => {
  const result = session.createReviewTimelineItems(
    [
      { type: "kill", time: 0 },
      { type: "kill", time: 30 },
      { type: "death", time: 90 },
      { type: "kill", time: 200 }
    ],
    120
  )

  assert.deepEqual(result, [
    {
      markerClass: "timeline-marker kill-marker",
      eventDotClass: "event-dot kill-marker",
      offsetPercent: 0,
      markerStyle: "left: 0px;",
      timeText: "0:00",
      typeText: "K"
    },
    {
      markerClass: "timeline-marker kill-marker",
      eventDotClass: "event-dot kill-marker",
      offsetPercent: 25,
      markerStyle: "left: 86px;",
      timeText: "0:30",
      typeText: "K"
    },
    {
      markerClass: "timeline-marker death-marker",
      eventDotClass: "event-dot death-marker",
      offsetPercent: 75,
      markerStyle: "left: 259px;",
      timeText: "1:30",
      typeText: "D"
    },
    {
      markerClass: "timeline-marker kill-marker",
      eventDotClass: "event-dot kill-marker",
      offsetPercent: 100,
      markerStyle: "left: 345px;",
      timeText: "2:00",
      typeText: "K"
    }
  ])
})

runTest("createReviewTimelineAxis renders labels from actual duration", () => {
  assert.deepEqual(session.createReviewTimelineAxis(130), [
    { label: "0:00", style: "left: 0px;" },
    { label: "1:00", style: "left: 119px;" },
    { label: "2:00", style: "left: 264px;" }
  ])

  assert.deepEqual(session.createReviewTimelineAxis(1210), [
    { label: "0:00", style: "left: 0px;" },
    { label: "5:00", style: "left: 44px;" },
    { label: "10:00", style: "left: 131px;" },
    { label: "15:00", style: "left: 217px;" },
    { label: "20:00", style: "left: 264px;" }
  ])
})

runTest("isBackSwipe accepts right swipe and rejects vertical or left gestures", () => {
  assert.equal(navigation.isBackSwipe(20, 200, 80, 96), true)
  assert.equal(navigation.isBackSwipe(200, 20, 80, 96), false)
  assert.equal(navigation.isBackSwipe(20, 200, 40, 180), false)
  assert.equal(navigation.isBackSwipe(20, 60, 80, 82), false)
})

runTest("isDeleteSwipe only accepts left swipe distinct from back gesture", () => {
  assert.equal(navigation.isDeleteSwipe(220, 90, 80, 92), true)
  assert.equal(navigation.isDeleteSwipe(90, 220, 80, 92), false)
  assert.equal(navigation.isDeleteSwipe(220, 90, 80, 180), false)
})

runTest("design exposes shared page padding styles", () => {
  assert.equal(design.PAGE_PADDING.square, 10)
  assert.equal(design.PAGE_PADDING.circle, 48)
  assert.equal(design.pagePaddingStyle("square"), "padding-left: 10px; padding-right: 10px;")
  assert.equal(design.pagePaddingStyle("circle"), "padding-left: 48px; padding-right: 48px;")
})

runTest("design constants centralize watch colors radius and padding", () => {
  assert.equal(designConstants.PAGE_PADDING.square, 10)
  assert.equal(designConstants.PAGE_PADDING.circle, 48)
  assert.equal(designConstants.PAGE_PADDING.topBar, 70)
  assert.equal(designConstants.COLORS.kill, "#ff1744")
  assert.equal(designConstants.COLORS.death, "#2979ff")
  assert.equal(designConstants.COLORS.pageBackground, "#000000")
  assert.equal(designConstants.RADIUS.card, 30)
  assert.equal(designConstants.RADIUS.control, 10)
})

runTest("setting constants provide reusable option menu definitions", () => {
  assert.equal(settingConstants.SETTINGS_KEY, "wargame_settings")
  assert.equal(settingConstants.SETTING_MENUS.trigger.settingKey, "triggerMode")
  assert.equal(settingConstants.SETTING_MENUS.killVibration.settingKey, "killVibration")
  assert.equal(settingConstants.SETTING_MENUS.deathVibration.settingKey, "deathVibration")
  assert.deepEqual(
    settingConstants.createSettingMenuOptions("trigger", "click").map((option) => ({
      value: option.value,
      optionClass: option.optionClass
    })),
    [
      { value: "longPress", optionClass: "menu-option" },
      { value: "click", optionClass: "menu-option selected-option" }
    ]
  )
  assert.equal(settingConstants.getSelectedValue("killVibration", { killVibration: "long" }), "long")
  assert.deepEqual(
    settingConstants.applySettingOption("deathVibration", { deathVibration: "short" }, "off"),
    { deathVibration: "off" }
  )
})

runTest("option page definitions own settings storage and update callbacks", () => {
  const rawSettings = JSON.stringify({ triggerMode: "click", killVibration: "long" })
  const model = optionPage.createOptionPageModel("killVibration", rawSettings)

  assert.equal(model.storageKey, settingConstants.SETTINGS_KEY)
  assert.equal(model.titleKey, "settings.items.killVibration.title")
  assert.deepEqual(
    model.options.map((option) => ({ value: option.value, optionClass: option.optionClass })),
    [
      { value: "short", optionClass: "menu-option" },
      { value: "double", optionClass: "menu-option" },
      { value: "long", optionClass: "menu-option selected-option" },
      { value: "off", optionClass: "menu-option" }
    ]
  )

  assert.deepEqual(JSON.parse(optionPage.createOptionPageStorageValue("killVibration", rawSettings, "off")), {
    triggerMode: "click",
    killVibration: "off",
    deathVibration: "long",
    aodEnabled: false,
    visualMode: "simple",
    interconnectDebugEnabled: false
  })
})

runTest("settings option page receives menu type through router params", () => {
  const settingsUx = fs.readFileSync(path.join(__dirname, "../src/pages/settings/settings.ux"), "utf8")
  const optionUx = fs.readFileSync(path.join(__dirname, "../src/pages/settings-option/settings-option.ux"), "utf8")

  assert.ok(settingsUx.indexOf("params: {") >= 0)
  assert.ok(settingsUx.indexOf("menuType: type") >= 0)
  assert.ok(optionUx.indexOf("protected: {") >= 0)
  assert.ok(optionUx.indexOf('menuType: "trigger"') >= 0)
  assert.ok(optionUx.indexOf("optionPage.createOptionPageModel") >= 0)
  assert.equal(optionUx.indexOf("sessionHelper"), -1)
  assert.equal(optionUx.indexOf("settingConstants"), -1)
  assert.equal(optionUx.indexOf("SETTINGS_KEY"), -1)
  assert.equal(settingsUx.indexOf("wargame_settings_menu"), -1)
  assert.equal(optionUx.indexOf("wargame_settings_menu"), -1)
})

runTest("settings pages use i18n text keys instead of hardcoded labels", () => {
  const settingsUx = fs.readFileSync(path.join(__dirname, "../src/pages/settings/settings.ux"), "utf8")
  const optionUx = fs.readFileSync(path.join(__dirname, "../src/pages/settings-option/settings-option.ux"), "utf8")
  const zh = JSON.parse(fs.readFileSync(path.join(__dirname, "../src/i18n/zh-CN.json"), "utf8"))
  const en = JSON.parse(fs.readFileSync(path.join(__dirname, "../src/i18n/en.json"), "utf8"))
  const defaults = JSON.parse(fs.readFileSync(path.join(__dirname, "../src/i18n/defaults.json"), "utf8"))

  assert.ok(settingsUx.indexOf('title-text="{{ $t(\'settings.title\') }}"') >= 0)
  assert.ok(optionUx.indexOf('title-text="{{ $t(menuTitleKey) }}"') >= 0)
  assert.ok(optionUx.indexOf("$t($item.labelKey)") >= 0)
  assert.equal(settingsUx.indexOf(">设置<"), -1)
  assert.equal(optionUx.indexOf("触发方式"), -1)
  assert.equal(defaults.common.empty, "")
  assert.equal(zh.common.empty, "")
  assert.equal(en.common.empty, "")
  assert.equal(zh.settings.title, "设置")
  assert.equal(en.settings.title, "Settings")
})

runTest("watch pages use explicit custom components without slot wrappers", () => {
  var indexUx = fs.readFileSync(path.join(__dirname, "../src/pages/index/index.ux"), "utf8")
  var historyUx = fs.readFileSync(path.join(__dirname, "../src/pages/history/history.ux"), "utf8")
  var reviewUx = fs.readFileSync(path.join(__dirname, "../src/pages/review/review.ux"), "utf8")
  var settingsUx = fs.readFileSync(path.join(__dirname, "../src/pages/settings/settings.ux"), "utf8")
  var optionUx = fs.readFileSync(path.join(__dirname, "../src/pages/settings-option/settings-option.ux"), "utf8")
  var titleBarUx = fs.readFileSync(path.join(__dirname, "../src/components/title-bar.ux"), "utf8")
  var confirmDialogUx = fs.readFileSync(path.join(__dirname, "../src/components/confirm-dialog.ux"), "utf8")
  var actionOverlayUx = fs.readFileSync(path.join(__dirname, "../src/components/action-overlay.ux"), "utf8")
  var iconActionUx = fs.readFileSync(path.join(__dirname, "../src/components/icon-action.ux"), "utf8")
  var commonCss = fs.readFileSync(path.join(__dirname, "../src/common/styles.css"), "utf8")

    ;[
      indexUx,
      historyUx,
      reviewUx,
      settingsUx,
      optionUx,
      titleBarUx,
      confirmDialogUx,
      actionOverlayUx,
      iconActionUx
    ].forEach((ux) => {
      assert.equal(ux.indexOf("<slot"), -1)
    })
  assert.ok(indexUx.indexOf('<import src="../../components/action-overlay.ux" name="action-overlay"></import>') >= 0)
  assert.ok(indexUx.indexOf('<import src="../../components/confirm-dialog.ux" name="confirm-dialog"></import>') >= 0)
  assert.ok(indexUx.indexOf("<action-overlay") >= 0)
  assert.ok(indexUx.indexOf("<confirm-dialog") >= 0)
  assert.ok(historyUx.indexOf('<import src="../../components/title-bar.ux" name="title-bar"></import>') >= 0)
  assert.ok(historyUx.indexOf('<import src="../../components/confirm-dialog.ux" name="confirm-dialog"></import>') >= 0)
  assert.ok(historyUx.indexOf("<title-bar") >= 0)
  assert.ok(historyUx.indexOf('title-text="{{ $t(\'history.title\') }}"') >= 0)
  assert.ok(historyUx.indexOf("<confirm-dialog") >= 0)
  assert.ok(historyUx.indexOf('title-text="{{ $t(\'history.deleteTitle\') }}"') >= 0)
  assert.ok(historyUx.indexOf('message-text="{{ $t(\'history.deleteMessage\') }}"') >= 0)
  assert.ok(historyUx.indexOf('cancel-text="{{ $t(\'common.cancel\') }}"') >= 0)
  assert.ok(historyUx.indexOf('ok-text="{{ $t(\'common.delete\') }}"') >= 0)
  assert.ok(reviewUx.indexOf("<title-bar") >= 0)
  assert.ok(settingsUx.indexOf("<title-bar") >= 0)
  assert.ok(optionUx.indexOf("<title-bar") >= 0)
    ;[historyUx, reviewUx, settingsUx, optionUx].forEach((ux) => {
      assert.ok(ux.indexOf("title-text=") >= 0)
      assert.ok(ux.indexOf("right-text=") >= 0)
      assert.equal(ux.indexOf("title-bar-host"), -1)
      assert.equal(ux.indexOf("title-key="), -1)
      assert.equal(ux.indexOf("right-key="), -1)
      assert.equal(ux.indexOf("title-prefix="), -1)
      assert.equal(ux.indexOf("title-class="), -1)
      assert.equal(ux.indexOf("right-class="), -1)
      assert.equal(ux.indexOf("right-style="), -1)
    })
  assert.ok(titleBarUx.indexOf("props:") >= 0)
  assert.ok(titleBarUx.indexOf("titleText") >= 0)
  assert.ok(titleBarUx.indexOf('class="title-text"') >= 0)
  assert.ok(titleBarUx.indexOf('class="title-right-text"') >= 0)
  assert.ok(confirmDialogUx.indexOf("titleText") >= 0)
  assert.ok(confirmDialogUx.indexOf("messageText") >= 0)
  assert.ok(confirmDialogUx.indexOf("cancelText") >= 0)
  assert.ok(confirmDialogUx.indexOf("okText") >= 0)
  assert.equal(titleBarUx.indexOf("$t("), -1)
  assert.equal(titleBarUx.indexOf('class="{{'), -1)
  assert.equal(titleBarUx.indexOf('style="{{'), -1)
  assert.equal(confirmDialogUx.indexOf("$t("), -1)
  assert.equal(titleBarUx.indexOf("titleKey"), -1)
  assert.equal(confirmDialogUx.indexOf("titleKey"), -1)
  assert.equal(confirmDialogUx.indexOf("messageKey"), -1)
  assert.equal(commonCss.indexOf(".title-bar-host"), -1)
  assert.ok(titleBarUx.indexOf("flex-direction: row;") >= 0)
  assert.equal(titleBarUx.indexOf("position: absolute;"), -1)
  assert.ok(confirmDialogUx.indexOf('this.$emit("confirm")') >= 0)
})

runTest("action overlay stays single-layer and receives actions from the page", () => {
  const indexUx = fs.readFileSync(path.join(__dirname, "../src/pages/index/index.ux"), "utf8")
  const actionOverlayUx = fs.readFileSync(path.join(__dirname, "../src/components/action-overlay.ux"), "utf8")

  assert.equal(actionOverlayUx.indexOf("<import"), -1)
  assert.equal(actionOverlayUx.indexOf("<icon-action"), -1)
  assert.ok(actionOverlayUx.indexOf("actions: []") >= 0)
  assert.ok(actionOverlayUx.indexOf('for="{{ actions }}"') >= 0)
  assert.ok(actionOverlayUx.indexOf('this.$emit(eventName)') >= 0)
  assert.ok(actionOverlayUx.indexOf('onclick="close"') >= 0)
  assert.ok(actionOverlayUx.indexOf('this.$emit("close")') >= 0)
  assert.ok(indexUx.indexOf('actions="{{ undoOverlayActions }}"') >= 0)
  assert.ok(indexUx.indexOf('actions="{{ moreOverlayActions }}"') >= 0)
  assert.ok(indexUx.indexOf('onclose="closeUndoPanel"') >= 0)
  assert.ok(indexUx.indexOf('onclose="closeMorePanel"') >= 0)
})

runTest("action overlay layout and offset are configured by page props", () => {
  const indexUx = fs.readFileSync(path.join(__dirname, "../src/pages/index/index.ux"), "utf8")
  const actionOverlayUx = fs.readFileSync(path.join(__dirname, "../src/components/action-overlay.ux"), "utf8")

  assert.equal(actionOverlayUx.indexOf("actionsClass"), -1)
  assert.ok(actionOverlayUx.indexOf("vertical: false") >= 0)
  assert.ok(actionOverlayUx.indexOf('if="{{ vertical }}"') >= 0)
  assert.ok(actionOverlayUx.indexOf('if="{{ !vertical }}"') >= 0)
  assert.ok(actionOverlayUx.indexOf("actionsStyle") >= 0)
  assert.equal(indexUx.indexOf("undoOverlayClass"), -1)
  assert.equal(indexUx.indexOf("moreOverlayClass"), -1)
  assert.ok(indexUx.indexOf('vertical="{{ undoOverlayVertical }}"') >= 0)
  assert.ok(indexUx.indexOf('vertical="{{ moreOverlayVertical }}"') >= 0)
  assert.ok(indexUx.indexOf("undoOverlayVertical: false") >= 0)
  assert.ok(indexUx.indexOf("moreOverlayVertical: true") >= 0)
  assert.ok(indexUx.indexOf('actions-style="{{ undoOverlayStyle }}"') >= 0)
  assert.ok(indexUx.indexOf('actions-style="{{ moreOverlayStyle }}"') >= 0)
  assert.ok(actionOverlayUx.indexOf("overlay-actions-horizontal") >= 0)
  assert.ok(actionOverlayUx.indexOf("overlay-actions-vertical") >= 0)
})

runTest("icon action keeps visible border and restrained icon size", () => {
  const iconActionUx = fs.readFileSync(path.join(__dirname, "../src/components/icon-action.ux"), "utf8")

  assert.ok(iconActionUx.indexOf("border-width: 1px;") >= 0)
  assert.ok(iconActionUx.indexOf("border-color: #dbdbdb;") >= 0)
  assert.ok(iconActionUx.indexOf("width: 74px;") >= 0)
  assert.ok(iconActionUx.indexOf("height: 74px;") >= 0)
})

runTest("watch page styles are split out of large ux pages", () => {
  const pagePaths = [
    "../src/pages/index/index.ux",
    "../src/pages/history/history.ux",
    "../src/pages/review/review.ux",
    "../src/pages/settings/settings.ux",
    "../src/pages/settings-option/settings-option.ux"
  ]

  pagePaths.forEach((pagePath) => {
    const ux = fs.readFileSync(path.join(__dirname, pagePath), "utf8")
    const styleMatch = ux.match(/<style>([\s\S]*)<\/style>/)

    assert.ok(styleMatch)
    assert.ok(styleMatch[1].indexOf('@import "../../common/styles.css";') >= 0)
    assert.ok(styleMatch[1].indexOf('@import "./') >= 0)
    assert.equal(/\.[a-zA-Z0-9_-]+\s*\{/.test(styleMatch[1]), false)
  })
})

runTest("runtime-unstable slot component wrappers are not kept in components", () => {
  const componentDir = path.join(__dirname, "../src/components")
  const componentFiles = fs.existsSync(componentDir)
    ? fs.readdirSync(componentDir).filter((file) => file.endsWith(".ux"))
    : []

  componentFiles.forEach((file) => {
    const ux = fs.readFileSync(path.join(componentDir, file), "utf8")
    assert.equal(ux.indexOf("<slot"), -1)
  })
})

runTest("history page helper builds row display models", () => {
  const items = historyPage.createHistoryItems(
    [
      {
        sessionId: "a",
        startTime: Date.UTC(2026, 6, 9),
        status: "synced",
        summary: { kills: 4, deaths: 2 }
      },
      {
        sessionId: "b",
        startTime: Date.UTC(2026, 6, 10),
        status: "finished",
        summary: { kills: 3, deaths: 0 }
      }
    ],
    "b"
  )

  assert.deepEqual(
    items.map((item) => ({
      sessionId: item.sessionId,
      dateText: item.dateText,
      statusKey: item.statusKey,
      ratioText: item.ratioText,
      deleteVisible: item.deleteVisible,
      itemContentClass: item.itemContentClass
    })),
    [
      {
        sessionId: "a",
        dateText: "2026-07-09",
        statusKey: "history.synced",
        ratioText: "2.00",
        deleteVisible: false,
        itemContentClass: "item-content"
      },
      {
        sessionId: "b",
        dateText: "2026-07-10",
        statusKey: "history.unsynced",
        ratioText: "3.00",
        deleteVisible: true,
        itemContentClass: "item-content item-content-open"
      }
    ]
  )
})

runTest("review page helper builds session display model", () => {
  const model = reviewPage.createReviewModel({
    sessionId: "s1",
    startTime: new Date(2026, 6, 9, 12, 0, 0).getTime(),
    endTime: new Date(2026, 6, 9, 12, 2, 5).getTime(),
    status: "finished",
    summary: { kills: 5, deaths: 2 },
    events: [{ type: "kill", time: 30 }]
  })

  assert.equal(model.hasSession, true)
  assert.equal(model.titleDateText, "2026-07-09 ")
  assert.equal(model.ratioText, "2.50")
  assert.equal(model.syncKey, "review.unsyncedRetry")
  assert.equal(model.rangeText, "12:00:00 - 12:02:05")
  assert.equal(model.durationMinutes, 2)
  assert.equal(model.durationSeconds, 5)
  assert.equal(model.timelineItems.length, 1)
})

runTest("review uses the provided ratio triangle image asset", () => {
  const reviewUx = fs.readFileSync(path.join(__dirname, "../src/pages/review/review.ux"), "utf8")

  assert.ok(fs.existsSync(path.join(__dirname, "../src/common/ratio-triangle.png")))
  assert.ok(reviewUx.indexOf('<image class="ratio-triangle" src="/common/ratio-triangle.png"></image>') >= 0)
})

runTest("review timeline renders axis line and scrollable full event list", () => {
  const reviewUx = fs.readFileSync(path.join(__dirname, "../src/pages/review/review.ux"), "utf8")

  assert.ok(reviewUx.indexOf('<scroll class="review-body" scroll-y="true" if="{{ hasSession }}">') >= 0)
  assert.ok(reviewUx.indexOf('<div class="review-content-item">') >= 0)
  assert.ok(reviewUx.indexOf('<div class="axis-line"></div>') >= 0)
  assert.ok(reviewUx.indexOf('<div class="timeline-list">') >= 0)
  assert.ok(reviewUx.indexOf('<div class="event-item" for="{{ timelineListItems }}">') >= 0)
  assert.equal(/\.timeline-card\s*\{[^}]*height:/m.test(reviewUx), false)
  assert.equal(/\.timeline-list\s*\{[^}]*height:/m.test(reviewUx), false)
  assert.equal(reviewUx.indexOf("timelineItems.slice"), -1)
})

runTest("history only renders delete action when the row is revealed", () => {
  const historyUx = fs.readFileSync(path.join(__dirname, "../src/pages/history/history.ux"), "utf8")
  const historyHelper = fs.readFileSync(path.join(__dirname, "../src/common/history-page.js"), "utf8")

  assert.ok(historyUx.indexOf('if="{{ $item.deleteVisible }}"') >= 0)
  assert.ok(historyHelper.indexOf("deleteVisible:") >= 0)
})

runTest("defaultSettings provides battle interaction defaults", () => {
  assert.deepEqual(session.defaultSettings(), {
    triggerMode: "longPress",
    killVibration: "short",
    deathVibration: "long",
    aodEnabled: false,
    visualMode: "simple",
    interconnectDebugEnabled: false
  })
})

runTest("normalizeSettings keeps valid choices and replaces invalid ones with defaults", () => {
  assert.deepEqual(
    session.normalizeSettings({
      triggerMode: "click",
      killVibration: "double",
      deathVibration: "off",
      aodEnabled: true,
      visualMode: "detailed",
      interconnectDebugEnabled: true
    }),
    {
      triggerMode: "click",
      killVibration: "double",
      deathVibration: "off",
      aodEnabled: true,
      visualMode: "detailed",
      interconnectDebugEnabled: true
    }
  )

  assert.deepEqual(
    session.normalizeSettings({
      triggerMode: "swipe",
      killVibration: "buzz",
      deathVibration: "",
      aodEnabled: "yes",
      visualMode: "cinema"
    }),
    session.defaultSettings()
  )
})

runTest("createDisplaySummary returns idle display values without creating a session", () => {
  assert.deepEqual(session.createDisplaySummary(null, 1752057600000), {
    kills: 0,
    deaths: 0,
    ratioText: "0.00",
    durationText: "00:00",
    aodSummaryText: "K 0 / D 0",
    running: false
  })
})

runTest("createDisplaySummary returns live values for an ongoing session", () => {
  const started = session.createSession(1752057600000)
  const withEvents = session.addEvent(
    session.addEvent(started, "kill", 1752057661000, "manual"),
    "death",
    1752057722000,
    "manual"
  )

  assert.deepEqual(session.createDisplaySummary(withEvents, 1752057783000), {
    kills: 1,
    deaths: 1,
    ratioText: "1.00",
    durationText: "03:03",
    aodSummaryText: "K 1 / D 1",
    running: true
  })
})

runTest("sync export includes only unsynced finished sessions", () => {
  const history = [
    {
      sessionId: "finished_unsynced",
      startTime: 3000,
      endTime: 4000,
      status: "finished",
      summary: { kills: 2, deaths: 1 },
      events: [{ eventId: "event_a", type: "kill", time: 5 }]
    },
    {
      sessionId: "already_synced",
      startTime: 2000,
      endTime: 3000,
      status: "synced",
      summary: { kills: 1, deaths: 1 },
      events: []
    },
    {
      sessionId: "still_running",
      startTime: 1000,
      endTime: 0,
      status: "ongoing",
      summary: { kills: 4, deaths: 0 },
      events: []
    }
  ]

  const payload = sync.createSyncExport(history, {
    deviceId: "watch_a",
    lastSyncAt: 123
  })

  assert.equal(payload.protocolVersion, 1)
  assert.equal(payload.deviceId, "watch_a")
  assert.equal(payload.lastSyncAt, 123)
  assert.deepEqual(
    payload.sessions.map((item) => item.sessionId),
    ["finished_unsynced"]
  )
})

runTest("sync push message includes protocol metadata and unsynced finished sessions", () => {
  const history = [
    {
      sessionId: "old_finished",
      startTime: 1000,
      endTime: 2000,
      status: "finished",
      summary: { kills: 1, deaths: 0 },
      events: [{ eventId: "event_old", type: "kill", time: 5 }]
    },
    {
      sessionId: "already_synced",
      startTime: 3000,
      endTime: 4000,
      status: "synced",
      summary: { kills: 2, deaths: 1 },
      events: []
    },
    {
      sessionId: "still_running",
      startTime: 4000,
      endTime: 0,
      status: "ongoing",
      summary: { kills: 3, deaths: 0 },
      events: []
    },
    {
      sessionId: "new_finished",
      startTime: 5000,
      endTime: 6000,
      status: "finished",
      summary: { kills: 4, deaths: 2 },
      events: [{ eventId: "event_new", type: "death", time: 10 }]
    }
  ]

  const payload = sync.createSyncPushMessage(history, {
    messageId: "sync_fixed",
    deviceId: "watch_a",
    createdAt: 1780000000000
  })

  assert.equal(payload.type, "wargame.sessions.push")
  assert.equal(payload.protocolVersion, 1)
  assert.equal(payload.messageId, "sync_fixed")
  assert.equal(payload.deviceId, "watch_a")
  assert.equal(payload.createdAt, 1780000000000)
  assert.deepEqual(
    payload.sessions.map((item) => item.sessionId),
    ["new_finished", "old_finished"]
  )
})

runTest("parse sync ack accepts valid protocol ack and filters invalid session ids", () => {
  const result = sync.parseSyncAck(JSON.stringify({
    type: "wargame.sessions.ack",
    protocolVersion: 1,
    ackMessageId: "sync_fixed",
    sessionIds: ["a", "", 42, "b", null]
  }))

  assert.deepEqual(result, {
    ackMessageId: "sync_fixed",
    sessionIds: ["a", "b"]
  })
})

runTest("parse sync ack returns null for invalid ack payloads", () => {
  assert.equal(sync.parseSyncAck("{"), null)
  assert.equal(sync.parseSyncAck(JSON.stringify({
    type: "wargame.sessions.push",
    protocolVersion: 1,
    ackMessageId: "sync_fixed",
    sessionIds: ["a"]
  })), null)
  assert.equal(sync.parseSyncAck(JSON.stringify({
    type: "wargame.sessions.ack",
    protocolVersion: 2,
    ackMessageId: "sync_fixed",
    sessionIds: ["a"]
  })), null)
  assert.equal(sync.parseSyncAck(JSON.stringify({
    type: "wargame.sessions.ack",
    protocolVersion: 1,
    ackMessageId: "sync_fixed",
    sessionIds: ["", 42, null]
  })), null)
})

runTest("sync ack marks only acknowledged sessions as synced", () => {
  const history = [
    {
      sessionId: "a",
      startTime: 3000,
      endTime: 4000,
      status: "finished",
      summary: { kills: 2, deaths: 1 },
      events: []
    },
    {
      sessionId: "b",
      startTime: 2000,
      endTime: 3000,
      status: "finished",
      summary: { kills: 1, deaths: 1 },
      events: []
    }
  ]

  const nextHistory = sync.applySyncAck(history, ["b", "missing"])

  assert.deepEqual(
    nextHistory.map((item) => ({ sessionId: item.sessionId, status: item.status })),
    [
      { sessionId: "a", status: "finished" },
      { sessionId: "b", status: "synced" }
    ]
  )
  assert.equal(history[1].status, "finished")
})

runTest("interconnect runtime wires Vela channel storage and sync helpers", () => {
  const runtime = fs.readFileSync(path.join(__dirname, "../src/common/interconnect-session-sync.js"), "utf8")

  assert.ok(runtime.indexOf('require("@system.interconnect")') >= 0)
  assert.ok(runtime.indexOf('require("@system.storage")') >= 0)
  assert.ok(runtime.indexOf('require("./session-sync-protocol.js")') >= 0)
  assert.ok(runtime.indexOf("onopen") >= 0)
  assert.ok(runtime.indexOf("onOpen") >= 0)
  assert.ok(runtime.indexOf("onmessage") >= 0)
  assert.ok(runtime.indexOf("onclose") >= 0)
  assert.ok(runtime.indexOf("onerror") >= 0)
  assert.ok(runtime.indexOf("createSyncPushMessage") >= 0)
  assert.ok(runtime.indexOf("applySyncAck") >= 0)
  assert.ok(runtime.indexOf("wargame_history") >= 0)
  assert.ok(runtime.indexOf("JSON.stringify") >= 0)
  assert.ok(runtime.indexOf("send") >= 0)
  assert.ok(runtime.indexOf("start: start") >= 0)
  assert.ok(runtime.indexOf("stop: stop") >= 0)
  assert.ok(runtime.indexOf("requestSync: requestSync") >= 0)
})

runTest("interconnect runtime shows debug toasts only when the setting is enabled", () => {
  const interconnectSync = require("../src/common/scripts/interconnect-session-sync.js")
  const toastMessages = []
  const connection = {
    onopen: function () { },
    onmessage: function () { },
    onclose: function () { },
    onerror: function () { },
    getReadyState: function () {
      return 0
    },
    send: function () { }
  }
  const runtime = interconnectSync._createRuntime({
    interconnect: {
      instance: function () {
        return connection
      }
    },
    prompt: {
      showToast: function (options) {
        toastMessages.push(options.message)
      }
    },
    storage: {
      get: function (options) {
        if (options.key === "wargame_settings") {
          options.success({ value: JSON.stringify({ interconnectDebugEnabled: true }) })
          return
        }

        options.success({ value: "[]" })
      },
      set: function () { }
    }
  })

  runtime.start()

  assert.ok(toastMessages.length > 0)
})

runTest("interconnect runtime reports official send failure details", () => {
  const interconnectSync = require("../src/common/scripts/interconnect-session-sync.js")
  const toastMessages = []
  const history = [
    {
      sessionId: "send_failure",
      startTime: 3000,
      endTime: 4000,
      status: "finished",
      summary: { kills: 2, deaths: 1 },
      events: []
    }
  ]
  const connection = {
    onopen: function () { },
    onmessage: function () { },
    onclose: function () { },
    onerror: function () { },
    getReadyState: function (options) {
      options.success({ status: 1 })
    },
    send: function (options) {
      options.fail({ data: "timeout" }, 204)
    }
  }
  const runtime = interconnectSync._createRuntime({
    interconnect: {
      instance: function () {
        return connection
      }
    },
    prompt: {
      showToast: function (options) {
        toastMessages.push(options.message)
      }
    },
    storage: {
      get: function (options) {
        if (options.key === "wargame_settings") {
          options.success({ value: JSON.stringify({ interconnectDebugEnabled: true }) })
          return
        }

        options.success({ value: JSON.stringify(history) })
      },
      set: function () { }
    }
  })

  runtime.start()

  assert.ok(toastMessages.some((message) => message.indexOf("timeout") >= 0))
  assert.ok(toastMessages.some((message) => message.indexOf("code=204") >= 0))
})

runTest("interconnect runtime keeps function handler APIs reusable across stop and restart", () => {
  const interconnectSync = require("../src/common/scripts/interconnect-session-sync.js")
  const registered = {
    open: [],
    message: []
  }
  const connection = {
    onopen: function (handler) {
      registered.open.push(handler)
    },
    onmessage: function (handler) {
      registered.message.push(handler)
    },
    onclose: function () { },
    onerror: function () { },
    getReadyState: function () {
      return 1
    },
    send: function () { }
  }
  const runtime = interconnectSync._createRuntime({
    interconnect: {
      instance: function () {
        return connection
      }
    },
    storage: {
      get: function (options) {
        options.success({ value: "[]" })
      },
      set: function () { }
    }
  })

  runtime.start()
  runtime.stop()
  runtime.start()

  assert.equal(typeof connection.onopen, "function")
  assert.equal(typeof connection.onmessage, "function")
  assert.equal(registered.open.length, 2)
  assert.equal(registered.message.length, 2)
})

runTest("interconnect runtime waits for ready open channel before sending sync", () => {
  const interconnectSync = require("../src/common/scripts/interconnect-session-sync.js")
  const sent = []
  const registered = {}
  var readyState = 0
  const history = [
    {
      sessionId: "pending",
      startTime: 3000,
      endTime: 4000,
      status: "finished",
      summary: { kills: 2, deaths: 1 },
      events: []
    }
  ]
  const connection = {
    onopen: function (handler) {
      registered.open = handler
    },
    onmessage: function (handler) {
      registered.message = handler
    },
    onclose: function () { },
    onerror: function () { },
    getReadyState: function () {
      return readyState
    },
    send: function (options) {
      sent.push(options.data)
      if (options.success) {
        options.success()
      }
    }
  }
  const runtime = interconnectSync._createRuntime({
    interconnect: {
      instance: function () {
        return connection
      }
    },
    storage: {
      get: function (options) {
        options.success({ value: JSON.stringify(history) })
      },
      set: function () { }
    }
  })

  runtime.start()
  runtime.requestSync()
  readyState = 1
  registered.open()

  assert.equal(sent.length, 1)
  assert.equal(sent[0].type, "wargame.sessions.push")
  assert.deepEqual(
    sent[0].sessions.map((item) => item.sessionId),
    ["pending"]
  )
})

runTest("interconnect runtime sends when the channel is already ready at startup", () => {
  const interconnectSync = require("../src/common/scripts/interconnect-session-sync.js")
  const sent = []
  const history = [
    {
      sessionId: "already_ready",
      startTime: 3000,
      endTime: 4000,
      status: "finished",
      summary: { kills: 2, deaths: 1 },
      events: []
    }
  ]
  const connection = {
    onopen: function () { },
    onmessage: function () { },
    onclose: function () { },
    onerror: function () { },
    getReadyState: function () {
      return 1
    },
    send: function (options) {
      sent.push(options.data)
      if (options.success) {
        options.success()
      }
    }
  }
  const runtime = interconnectSync._createRuntime({
    interconnect: {
      instance: function () {
        return connection
      }
    },
    storage: {
      get: function (options) {
        options.success({ value: JSON.stringify(history) })
      },
      set: function () { }
    }
  })

  runtime.start()

  assert.equal(sent.length, 1)
  assert.equal(sent[0].type, "wargame.sessions.push")
  assert.deepEqual(
    sent[0].sessions.map((item) => item.sessionId),
    ["already_ready"]
  )
})

runTest("interconnect runtime starts lazily when a page-local request arrives", () => {
  const interconnectSync = require("../src/common/scripts/interconnect-session-sync.js")
  const sent = []
  const toastMessages = []
  const history = [
    {
      sessionId: "lazy_start",
      startTime: 3000,
      endTime: 4000,
      status: "finished",
      summary: { kills: 2, deaths: 1 },
      events: []
    }
  ]
  const connection = {
    onopen: function () { },
    onmessage: function () { },
    onclose: function () { },
    onerror: function () { },
    getReadyState: function () {
      return 1
    },
    send: function (options) {
      sent.push(options.data)
      if (options.success) {
        options.success()
      }
    }
  }
  const runtime = interconnectSync._createRuntime({
    interconnect: {
      instance: function () {
        return connection
      }
    },
    prompt: {
      showToast: function (options) {
        toastMessages.push(options.message)
      }
    },
    storage: {
      get: function (options) {
        if (options.key === "wargame_settings") {
          options.success({ value: JSON.stringify({ interconnectDebugEnabled: true }) })
          return
        }

        options.success({ value: JSON.stringify(history) })
      },
      set: function () { }
    }
  })

  runtime.requestSync()

  assert.equal(sent.length, 1)
  assert.equal(sent[0].type, "wargame.sessions.push")
  assert.ok(toastMessages.some((message) => message.indexOf("request sync") >= 0))
})

runTest("interconnect runtime applies ack only when ackMessageId matches pending send", () => {
  const interconnectSync = require("../src/common/scripts/interconnect-session-sync.js")
  const written = []
  const registered = {}
  const history = [
    {
      sessionId: "ack_target",
      startTime: 3000,
      endTime: 4000,
      status: "finished",
      summary: { kills: 2, deaths: 1 },
      events: []
    }
  ]
  const connection = {
    onopen: function (handler) {
      registered.open = handler
    },
    onmessage: function (handler) {
      registered.message = handler
    },
    onclose: function () { },
    onerror: function () { },
    getReadyState: function () {
      return 1
    },
    send: function () { }
  }
  const runtime = interconnectSync._createRuntime({
    interconnect: {
      instance: function () {
        return connection
      }
    },
    storage: {
      get: function (options) {
        options.success({ value: JSON.stringify(history) })
      },
      set: function (options) {
        written.push(JSON.parse(options.value))
      }
    },
    now: function () {
      return 1780000000000
    }
  })

  runtime.start()
  registered.open()
  registered.message(JSON.stringify({
    type: "wargame.sessions.ack",
    protocolVersion: 1,
    ackMessageId: "sync_wrong",
    sessionIds: ["ack_target"]
  }))
  registered.message(JSON.stringify({
    type: "wargame.sessions.ack",
    protocolVersion: 1,
    ackMessageId: "sync_1780000000000",
    sessionIds: ["ack_target"]
  }))

  assert.equal(written.length, 1)
  assert.deepEqual(
    written[0].map((item) => ({ sessionId: item.sessionId, status: item.status })),
    [{ sessionId: "ack_target", status: "synced" }]
  )
})

runTest("app lifecycle starts and stops interconnect sync runtime", () => {
  const appUx = fs.readFileSync(path.join(__dirname, "../src/app.ux"), "utf8")

  assert.ok(appUx.indexOf('require("./common/scripts/interconnect-session-sync.js")') >= 0)
  assert.ok(appUx.indexOf("interconnectSync.start()") >= 0)
  assert.ok(appUx.indexOf("interconnectSync.stop()") >= 0)
})

runTest("battle page requests interconnect sync after history save succeeds", () => {
  const indexUx = fs.readFileSync(path.join(__dirname, "../src/pages/index/index.ux"), "utf8")
  const requireIndex = indexUx.indexOf('require("../../common/scripts/interconnect-session-sync.js")')
  const saveSuccessIndex = indexUx.indexOf('self.errorKey = ""')
  const requestIndex = indexUx.indexOf("interconnectSync.requestSync()")
  const clearCurrentIndex = indexUx.indexOf("self.currentSession = null")

  assert.ok(requireIndex >= 0)
  assert.ok(saveSuccessIndex >= 0)
  assert.ok(requestIndex > clearCurrentIndex)
})

runTest("review retry action requests real interconnect sync for unsynced sessions", () => {
  const reviewUx = fs.readFileSync(path.join(__dirname, "../src/pages/review/review.ux"), "utf8")
  const requireIndex = reviewUx.indexOf('require("../../common/scripts/interconnect-session-sync.js")')
  const retryIndex = reviewUx.indexOf("retrySync()")
  const requestIndex = reviewUx.indexOf("interconnectSync.requestSync()")

  assert.ok(requireIndex >= 0)
  assert.ok(requestIndex > retryIndex)
})
