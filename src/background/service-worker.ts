import { runCleanup } from "./cleanup";
import { createSelectionNote, installMessageHandler } from "./messages";
import { repository } from "../storage/repository";

const ALARM_NAME = "tabshelf-cleanup";

const ensureAlarm = async (): Promise<void> => {
  const root = await repository.getRoot();
  if (!root.ok) return;
  const current = await chrome.alarms.get(ALARM_NAME);
  if (!current || current.periodInMinutes !== root.data.settings.cleanupIntervalMinutes) {
    await chrome.alarms.clear(ALARM_NAME);
    await chrome.alarms.create(ALARM_NAME, {
      periodInMinutes: root.data.settings.cleanupIntervalMinutes,
    });
  }
};

const bootstrap = async (): Promise<void> => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  await ensureAlarm();
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: "tabshelf-save-selection",
    title: "Save selection to Tuck",
    contexts: ["selection"],
  });
};

installMessageHandler();
chrome.runtime.onInstalled.addListener(() => {
  void bootstrap();
});
chrome.runtime.onStartup.addListener(() => {
  void bootstrap();
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) void runCleanup();
});
chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "tabshelf-save-selection" && info.selectionText)
    void createSelectionNote(info.selectionText, info.pageUrl);
});
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "open-tabshelf") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.windowId !== undefined) await chrome.sidePanel.open({ windowId: tab.windowId });
});
