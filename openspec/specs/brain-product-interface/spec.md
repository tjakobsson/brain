# Brain Product Interface Specification

## Purpose

Defines a consistent Brain identity across the public command, package, container usage, automation, documentation, diagnostics, and active implementation surfaces before the first stable release.

## Requirements

### Requirement: Brain is the public product and command name
The project SHALL identify the product as Brain and SHALL expose `brain` as its executable name. Public usage text and documentation MUST describe the `brain build`, `brain preview`, and `brain serve` commands without offering a `brain-manual` compatibility alias.

#### Scenario: Display command help
- **WHEN** a user invokes the executable with `--help`
- **THEN** usage output names the executable `brain` and lists the supported commands

#### Scenario: Follow local container documentation
- **WHEN** a user follows a source-build or released-image example
- **THEN** the example uses the Brain name for local image tags, commands, and published image references

### Requirement: Active project identifiers use Brain naming
Package metadata, runtime configuration adapters, automation variables and paths, integration identifiers, diagnostics, deterministic namespaces, and tests SHALL use `brain` or `BRAIN_` naming instead of `brain-manual` or `BRAIN_MANUAL_` naming. Historical change artifacts that accurately record former behavior MAY retain the former name.

#### Scenario: Audit the tracked project before release
- **WHEN** active tracked files are searched for the former product identifier
- **THEN** no occurrences remain outside explicitly identified historical records

#### Scenario: Run generation through each supported surface
- **WHEN** a site is generated through the source command, released image, or composite Action
- **THEN** user-visible output and failure diagnostics consistently identify Brain

### Requirement: Rename occurs before stable compatibility guarantees
The former package name, executable name, and private configuration identifiers SHALL be replaced directly rather than retained as compatibility shims. The rename MUST preserve the documented build inputs, generated-site behavior, released image location, and Action interface except where those surfaces contain the former name.

#### Scenario: Use the renamed build command
- **WHEN** a user invokes `brain build` with inputs accepted by the former command
- **THEN** Brain generates the same production site contract without requiring a legacy alias or environment variable

### Requirement: Generated sites carry Brain visual identity
The generated site SHALL use an owned brain-shaped visual mark for Brain identity rather than a framework or starter mark. The same recognizable mark MUST appear as the site favicon and wherever the interface uses a compact icon to identify a Brain. The mark MUST remain legible at favicon and navigation sizes in both supported color schemes.

#### Scenario: Identify a generated site in the browser
- **WHEN** a reader opens a generated Brain site in a browser
- **THEN** the browser tab uses the Brain mark rather than the Astro mark

#### Scenario: Reuse the mark in the interface
- **WHEN** the interface identifies a Brain in the chooser or contextual navigation
- **THEN** it uses the same recognizable mark as the favicon while retaining adjacent text for that Brain's identity
