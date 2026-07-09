const assert = require("assert")
const fs = require("fs")
const path = require("path")

const session = require("../src/common/session.js")
const navigation = require("../src/common/navigation.js")
const design = require("../src/common/design.js")
const designConstants = require("../src/common/constants/design.js")
const settingConstants = require("../src/common/constants/settings.js")
const optionPage = require("../src/common/option-page.js")

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
      markerStyle: "left: 119px;",
      timeText: "0:30",
      typeText: "K"
    },
    {
      markerClass: "timeline-marker death-marker",
      eventDotClass: "event-dot death-marker",
      offsetPercent: 75,
      markerStyle: "left: 356px;",
      timeText: "1:30",
      typeText: "D"
    },
    {
      markerClass: "timeline-marker kill-marker",
      eventDotClass: "event-dot kill-marker",
      offsetPercent: 100,
      markerStyle: "left: 475px;",
      timeText: "2:00",
      typeText: "K"
    }
  ])
})

runTest("createReviewTimelineAxis renders labels from actual duration", () => {
  assert.deepEqual(session.createReviewTimelineAxis(130), [
    { label: "0:00", style: "left: 0px;" },
    { label: "1:00", style: "left: 179px;" },
    { label: "2:00", style: "left: 394px;" }
  ])

  assert.deepEqual(session.createReviewTimelineAxis(1210), [
    { label: "0:00", style: "left: 0px;" },
    { label: "5:00", style: "left: 76px;" },
    { label: "10:00", style: "left: 195px;" },
    { label: "15:00", style: "left: 314px;" },
    { label: "20:00", style: "left: 394px;" }
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
    visualMode: "simple"
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

  assert.ok(settingsUx.indexOf("$t('settings.title')") >= 0)
  assert.ok(optionUx.indexOf("$t($item.labelKey)") >= 0)
  assert.equal(settingsUx.indexOf(">设置<"), -1)
  assert.equal(optionUx.indexOf("触发方式"), -1)
  assert.equal(zh.settings.title, "设置")
  assert.equal(en.settings.title, "Settings")
})

runTest("watch pages avoid runtime-unstable slot components and use inline title bars", () => {
  var indexUx = fs.readFileSync(path.join(__dirname, "../src/pages/index/index.ux"), "utf8")
  var historyUx = fs.readFileSync(path.join(__dirname, "../src/pages/history/history.ux"), "utf8")
  var reviewUx = fs.readFileSync(path.join(__dirname, "../src/pages/review/review.ux"), "utf8")
  var settingsUx = fs.readFileSync(path.join(__dirname, "../src/pages/settings/settings.ux"), "utf8")
  var optionUx = fs.readFileSync(path.join(__dirname, "../src/pages/settings-option/settings-option.ux"), "utf8")

  ;[indexUx, historyUx, reviewUx, settingsUx, optionUx].forEach((ux) => {
    assert.equal(ux.indexOf("<import name="), -1)
    assert.equal(ux.indexOf("<slot"), -1)
  })
  assert.ok(historyUx.indexOf('<div class="title-bar">') >= 0)
  assert.ok(reviewUx.indexOf('<div class="title-bar">') >= 0)
  assert.ok(settingsUx.indexOf('<div class="title-bar">') >= 0)
  assert.ok(optionUx.indexOf('<div class="title-bar">') >= 0)
  assert.ok(indexUx.indexOf('<div class="confirm-dialog">') >= 0)
  assert.ok(historyUx.indexOf('<div class="confirm-dialog">') >= 0)
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

  assert.ok(historyUx.indexOf('if="{{ $item.deleteVisible }}"') >= 0)
  assert.ok(historyUx.indexOf("deleteVisible:") >= 0)
})

runTest("defaultSettings provides battle interaction defaults", () => {
  assert.deepEqual(session.defaultSettings(), {
    triggerMode: "longPress",
    killVibration: "short",
    deathVibration: "long",
    aodEnabled: false,
    visualMode: "simple"
  })
})

runTest("normalizeSettings keeps valid choices and replaces invalid ones with defaults", () => {
  assert.deepEqual(
    session.normalizeSettings({
      triggerMode: "click",
      killVibration: "double",
      deathVibration: "off",
      aodEnabled: true,
      visualMode: "detailed"
    }),
    {
      triggerMode: "click",
      killVibration: "double",
      deathVibration: "off",
      aodEnabled: true,
      visualMode: "detailed"
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
