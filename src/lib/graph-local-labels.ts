import { forceLocalLabelsOnNarrowZoom } from "./graph-style";

export interface LocalGraphLabelReveal {
  beginFit(): void;
  finishFitPlanning(): void;
  recordFit(): number;
  refresh(): void;
  destroy(): void;
}

export function wireLocalGraphLabelReveal(
  getCameraRatio: () => number,
  isNarrow: () => boolean,
  onChange: (reveal: boolean) => void,
  subscribe: (listener: () => void) => () => void,
): LocalGraphLabelReveal {
  let fittedRatio: number | null = null;
  let reveal = false;
  let fitting = false;

  const refresh = () => {
    const next = !fitting &&
      forceLocalLabelsOnNarrowZoom(isNarrow(), getCameraRatio(), fittedRatio);
    if (next === reveal) return;
    reveal = next;
    onChange(reveal);
  };
  const unsubscribe = subscribe(refresh);

  return {
    beginFit() {
      fitting = true;
      if (!reveal) return;
      reveal = false;
      onChange(false);
    },
    finishFitPlanning() {
      fitting = false;
      refresh();
    },
    recordFit() {
      fittedRatio = getCameraRatio();
      fitting = false;
      refresh();
      return fittedRatio;
    },
    refresh,
    destroy: unsubscribe,
  };
}
