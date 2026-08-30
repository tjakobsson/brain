import { forceLocalLabelsOnNarrowZoom } from "./graph-style";

export interface LocalGraphLabelReveal {
  resetForFit(): void;
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

  const refresh = () => {
    const next = forceLocalLabelsOnNarrowZoom(isNarrow(), getCameraRatio(), fittedRatio);
    if (next === reveal) return;
    reveal = next;
    onChange(reveal);
  };
  const unsubscribe = subscribe(refresh);

  return {
    resetForFit() {
      fittedRatio = null;
      if (!reveal) return;
      reveal = false;
      onChange(false);
    },
    recordFit() {
      fittedRatio = getCameraRatio();
      refresh();
      return fittedRatio;
    },
    refresh,
    destroy: unsubscribe,
  };
}
