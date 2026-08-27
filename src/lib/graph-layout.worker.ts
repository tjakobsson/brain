import { computeResponsiveTargets } from "./graph-motion-layout";
import type { LayoutRequest, LayoutResponse } from "./graph-motion-core";

const workerScope = self as unknown as {
  addEventListener(type: "message", listener: (event: MessageEvent<LayoutRequest>) => void): void;
  postMessage(message: LayoutResponse): void;
};

workerScope.addEventListener("message", (event) => {
  try {
    workerScope.postMessage({
      generation: event.data.generation,
      positions: computeResponsiveTargets(event.data),
    });
  } catch (error) {
    workerScope.postMessage({
      generation: event.data.generation,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
