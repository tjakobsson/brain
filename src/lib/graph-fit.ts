import type Sigma from "sigma";
import { positionBounds } from "./graph-motion-core";

export interface ViewportBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface FitCorrection {
  center: { x: number; y: number };
  viewportCenter: { x: number; y: number };
  scale: number;
  settled: boolean;
}

export interface FitInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface RenderedGraphFitOptions {
  animate?: boolean;
  duration?: number;
  padding?: number | Partial<FitInsets>;
  onAnimationStart?: () => void;
  onAnimationComplete?: () => void;
}

const DEFAULT_PADDING = 24;
const MAX_CORRECTIONS = 8;
const CAMERA_TARGET = { x: 0.5, y: 0.5, angle: 0, ratio: 1.12 };

function fitInsets(padding: number | Partial<FitInsets>): FitInsets {
  if (typeof padding === "number") {
    return { top: padding, right: padding, bottom: padding, left: padding };
  }
  return {
    top: padding.top ?? DEFAULT_PADDING,
    right: padding.right ?? DEFAULT_PADDING,
    bottom: padding.bottom ?? DEFAULT_PADDING,
    left: padding.left ?? DEFAULT_PADDING,
  };
}

export function graphFitInsets(renderer: Sigma, base = DEFAULT_PADDING): FitInsets {
  const insets = fitInsets(base);
  if (typeof document === "undefined" || typeof document.querySelector !== "function") return insets;
  const host = renderer.getContainer().getBoundingClientRect();
  const intersects = (bounds: DOMRect) =>
    bounds.right > host.left &&
    bounds.left < host.right &&
    bounds.bottom > host.top &&
    bounds.top < host.bottom;
  const controls = document.querySelector<HTMLElement>(".graph-controls")?.getBoundingClientRect();
  if (controls && intersects(controls)) {
    insets.top = Math.max(insets.top, controls.bottom - host.top + 12);
  }
  const navigation = document.querySelector<HTMLElement>(".site-header")?.getBoundingClientRect();
  if (navigation && intersects(navigation)) {
    insets.right = Math.max(insets.right, host.right - navigation.left + 12);
  }
  return insets;
}

function includeBounds(
  bounds: ViewportBounds | null,
  left: number,
  top: number,
  right: number,
  bottom: number,
): ViewportBounds {
  if (!bounds) return { left, top, right, bottom };
  return {
    left: Math.min(bounds.left, left),
    top: Math.min(bounds.top, top),
    right: Math.max(bounds.right, right),
    bottom: Math.max(bounds.bottom, bottom),
  };
}

interface RenderedMeasurement {
  bounds: ViewportBounds | null;
  fixedExtent: { width: number; height: number };
}

function measureRenderedGraph(renderer: Sigma, ids: Iterable<string>): RenderedMeasurement {
  const displayedLabels = renderer.getNodeDisplayedLabels();
  const settings = renderer.getSettings();
  const labelContext = renderer.getCanvases().labels?.getContext("2d");
  if (labelContext) {
    labelContext.font = `${settings.labelWeight} ${settings.labelSize}px ${settings.labelFont}`;
  }

  let bounds: ViewportBounds | null = null;
  const fixedExtent = { width: 0, height: 0 };
  for (const id of ids) {
    const data = renderer.getNodeDisplayData(id);
    if (!data || data.hidden) continue;
    const center = renderer.framedGraphToViewport(data);
    const radius = renderer.scaleSize(data.size);
    const item = {
      left: center.x - radius,
      top: center.y - radius,
      right: center.x + radius,
      bottom: center.y + radius,
    };

    if (labelContext && data.label && displayedLabels.has(id)) {
      const metrics = labelContext.measureText(data.label);
      const baseline = center.y + settings.labelSize / 3;
      const ascent = metrics.actualBoundingBoxAscent || settings.labelSize * 0.8;
      const descent = metrics.actualBoundingBoxDescent || settings.labelSize * 0.2;
      const left = center.x + radius + 3;
      item.top = Math.min(item.top, baseline - ascent);
      item.right = Math.max(item.right, left + metrics.width);
      item.bottom = Math.max(item.bottom, baseline + descent);
      fixedExtent.width = Math.max(fixedExtent.width, metrics.width + 3);
      fixedExtent.height = Math.max(fixedExtent.height, ascent + descent);
    }
    bounds = includeBounds(bounds, item.left, item.top, item.right, item.bottom);
  }
  return { bounds, fixedExtent };
}

export function measureRenderedBounds(renderer: Sigma, ids: Iterable<string>): ViewportBounds | null {
  return measureRenderedGraph(renderer, ids).bounds;
}

export function fitCorrection(
  bounds: ViewportBounds,
  dimensions: { width: number; height: number },
  padding: number | Partial<FitInsets> = DEFAULT_PADDING,
  fixedExtent = { width: 0, height: 0 },
): FitCorrection {
  const requested = fitInsets(padding);
  const horizontalScale = Math.min(1, dimensions.width / Math.max(requested.left + requested.right, 1));
  const verticalScale = Math.min(1, dimensions.height / Math.max(requested.top + requested.bottom, 1));
  const inset = {
    top: Math.max(0, requested.top * verticalScale),
    right: Math.max(0, requested.right * horizontalScale),
    bottom: Math.max(0, requested.bottom * verticalScale),
    left: Math.max(0, requested.left * horizontalScale),
  };
  const availableWidth = Math.max(dimensions.width - inset.left - inset.right, 1);
  const availableHeight = Math.max(dimensions.height - inset.top - inset.bottom, 1);
  const width = Math.max(bounds.right - bounds.left, 0);
  const height = Math.max(bounds.bottom - bounds.top, 0);
  const center = {
    x: (bounds.left + bounds.right) / 2,
    y: (bounds.top + bounds.bottom) / 2,
  };
  const viewportCenter = {
    x: inset.left + availableWidth / 2,
    y: inset.top + availableHeight / 2,
  };
  const constrainedScale = (total: number, available: number, fixed: number) => {
    const proportional = total / available;
    if (total <= available || fixed >= available) return proportional;
    return Math.max(proportional, (total - fixed) / (available - fixed));
  };
  const scale = Math.max(
    constrainedScale(width, availableWidth, fixedExtent.width),
    constrainedScale(height, availableHeight, fixedExtent.height),
    1,
  );
  const settled =
    scale <= 1.001 &&
    Math.abs(center.x - viewportCenter.x) <= 0.5 &&
    Math.abs(center.y - viewportCenter.y) <= 0.5;
  return { center, viewportCenter, scale, settled };
}

export function fitRenderedGraph(
  renderer: Sigma,
  requestedIds: Iterable<string>,
  options: RenderedGraphFitOptions = {},
): void {
  const graph = renderer.getGraph();
  const ids = [...new Set(requestedIds)].filter((id) => graph.hasNode(id)).sort();
  const positions = Object.fromEntries(
    ids.map((id) => [
      id,
      {
        x: graph.getNodeAttribute(id, "x") as number,
        y: graph.getNodeAttribute(id, "y") as number,
      },
    ]),
  );
  const source = renderer.getCamera().getState();
  renderer.setCustomBBox(positionBounds(positions, ids));
  renderer.refresh();
  renderer.getCamera().setState(CAMERA_TARGET);

  const dimensions = renderer.getDimensions();
  const padding = options.padding ?? graphFitInsets(renderer);
  for (let pass = 0; pass < MAX_CORRECTIONS; pass += 1) {
    renderer.refresh();
    const measurement = measureRenderedGraph(renderer, ids);
    if (!measurement.bounds) break;
    const correction = fitCorrection(
      measurement.bounds,
      dimensions,
      padding,
      measurement.fixedExtent,
    );
    if (correction.settled) break;
    const state = renderer.getCamera().getState();
    const zoomScale = correction.scale > 1.001 ? correction.scale * 1.02 : 1;
    const cameraPoint = {
      x: correction.center.x + (dimensions.width / 2 - correction.viewportCenter.x) * zoomScale,
      y: correction.center.y + (dimensions.height / 2 - correction.viewportCenter.y) * zoomScale,
    };
    const center = renderer.viewportToFramedGraph(cameraPoint);
    const ratio = state.ratio * zoomScale;
    const maximumRatio = renderer.getSetting("maxCameraRatio");
    if (maximumRatio !== null && ratio > maximumRatio) {
      renderer.setSetting("maxCameraRatio", ratio);
    }
    renderer.getCamera().setState({
      x: center.x,
      y: center.y,
      angle: 0,
      // Fixed-pixel labels need a stronger correction than graph geometry alone.
      ratio,
    });
  }

  const target = renderer.getCamera().getState();
  if (!options.animate) {
    // Replacing an active animation prevents its next frame from restoring a stale camera state.
    void renderer.getCamera().animate(target, { duration: 1 });
    renderer.getCamera().setState(target);
    options.onAnimationComplete?.();
    return;
  }
  renderer.getCamera().setState(source);
  options.onAnimationStart?.();
  renderer.getCamera().animate(
    target,
    { duration: options.duration ?? 320, easing: "quadraticInOut" },
    options.onAnimationComplete,
  );
}
