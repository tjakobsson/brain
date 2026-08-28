export const WORKSPACE_VERSION: 1;
export const DEFAULT_BRAIN_ACCENTS: readonly string[];

export interface WorkspaceGroup {
  id: string;
  title: string;
  parent?: string;
}

export interface WorkspaceBrain {
  id: string;
  title: string;
  path: string;
  configuredPath: string;
  group?: string;
  description?: string;
  accent: string;
  exclusions: string[];
  effectiveExclusions: string[];
}

export interface WorkspaceDefinition {
  version: 1;
  title: string;
  description?: string;
  exclusions: string[];
  groups: WorkspaceGroup[];
  brains: WorkspaceBrain[];
  manifestPath: string;
}

export class WorkspaceValidationError extends Error {}

export function parseWorkspaceManifest(source: string, manifestPath?: string): WorkspaceDefinition;
export function loadWorkspaceManifest(manifestPath: string): WorkspaceDefinition;
