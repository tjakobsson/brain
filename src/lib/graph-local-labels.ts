import { forceLocalLabelsOnNarrowZoom } from "./graph-style";

export interface LocalGraphLabelReveal {
  recordFit(): void;
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
    recordFit() {
      fittedRatio = getCameraRatio();
      refresh();
    },
    refresh,
    destroy: unsubscribe,
  };
}
