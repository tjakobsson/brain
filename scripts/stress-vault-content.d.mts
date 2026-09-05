export declare const BRAIN_IDS: readonly string[];
export declare const BRAIN_TITLES: readonly string[];
export declare const TITLE_CAPACITY: number;
export declare function noteTitle(index: number): string;
export declare function brainId(index: number): string;
export declare function brainTitle(index: number): string;
export declare function composedWorkspaceLabel(
  brainIndex: number,
  noteIndex: number,
  marker?: string,
): string;
