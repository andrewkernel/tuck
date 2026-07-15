import { afterEach, vi } from "vitest";

let store: Record<string, unknown> = {};

export const resetChrome = () => {
  store = {};
  Object.assign(globalThis, {
    chrome: {
      storage: {
        local: {
          get: vi.fn(async (key: string) => ({ [key]: store[key] })),
          set: vi.fn(async (value: Record<string, unknown>) => {
            Object.assign(store, value);
          }),
        },
      },
      tabs: {
        get: vi.fn(),
        query: vi.fn(),
        remove: vi.fn(),
        discard: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        group: vi.fn(),
      },
      tabGroups: { TAB_GROUP_ID_NONE: -1, update: vi.fn() },
      alarms: { get: vi.fn(), clear: vi.fn(), create: vi.fn(), onAlarm: { addListener: vi.fn() } },
      sidePanel: { setPanelBehavior: vi.fn(), open: vi.fn() },
      contextMenus: { removeAll: vi.fn(), create: vi.fn(), onClicked: { addListener: vi.fn() } },
      commands: { onCommand: { addListener: vi.fn() } },
      runtime: {
        onMessage: { addListener: vi.fn() },
        onInstalled: { addListener: vi.fn() },
        onStartup: { addListener: vi.fn() },
        sendMessage: vi.fn(),
      },
    },
  });
};

resetChrome();
afterEach(() => resetChrome());
