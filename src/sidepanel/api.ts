import type { ExtensionMessage } from "../background/messages";
import type { Result } from "../domain/types";

export const send = <T>(message: ExtensionMessage): Promise<Result<T>> =>
  chrome.runtime.sendMessage(message) as Promise<Result<T>>;
