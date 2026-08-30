import { describe, expect, it, vi } from "vitest";
import { wireLocalGraphLabelReveal } from "./graph-local-labels";

describe("local graph label reveal", () => {
  it("reveals on relative zoom and resets after a new fitted view", () => {
    let ratio = 2;
    let cameraUpdated = () => {};
    const changes: boolean[] = [];
    const reveal = wireLocalGraphLabelReveal(
      () => ratio,
      () => true,
      (next) => changes.push(next),
      (listener) => {
        cameraUpdated = listener;
        return () => {};
      },
    );

    expect(reveal.recordFit()).toBe(2);
    ratio = 1.5;
    cameraUpdated();
    cameraUpdated();
    expect(changes).toEqual([true]);

    ratio = 1.8;
    cameraUpdated();
    expect(changes).toEqual([true, false]);

    ratio = 1;
    cameraUpdated();
    expect(changes).toEqual([true, false, true]);
    reveal.resetForFit();
    expect(changes).toEqual([true, false, true, false]);
    expect(reveal.recordFit()).toBe(1);
    expect(changes).toEqual([true, false, true, false]);
  });

  it("stops observing camera updates when destroyed", () => {
    let ratio = 1;
    let cameraUpdated = () => {};
    const unsubscribe = vi.fn(() => {
      cameraUpdated = () => {};
    });
    const onChange = vi.fn();
    const reveal = wireLocalGraphLabelReveal(
      () => ratio,
      () => true,
      onChange,
      (listener) => {
        cameraUpdated = listener;
        return unsubscribe;
      },
    );

    reveal.recordFit();
    reveal.destroy();
    expect(unsubscribe).toHaveBeenCalledOnce();

    ratio = 0.5;
    cameraUpdated();
    expect(onChange).not.toHaveBeenCalled();
  });
});
