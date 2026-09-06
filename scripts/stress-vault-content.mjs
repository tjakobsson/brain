/**
 * Generated content for the synthetic stress workspace.
 *
 * Titles and brain ids are composed here rather than in the generator so a
 * unit test can measure their distribution without writing a vault to disk.
 * Everything is invented: the fixture is public and must stay self-contained,
 * so no title or identifier is copied from a personal vault. What is borrowed
 * is only the *shape* of a real vault — sentence-length titles and brain ids
 * long enough to dominate a composed workspace label — because a fixture that
 * cannot reproduce a real label width cannot fail on one.
 */

/** Four invented brains whose ids run to the length a real workspace reaches. */
export const BRAIN_IDS = [
  "engineering-practice-and-delivery-systems",
  "design-systems-and-interface-craft",
  "research-synthesis-and-source-trails",
  "product-strategy-and-planning-notes",
];

export const BRAIN_TITLES = [
  "Engineering practice and delivery systems",
  "Design systems and interface craft",
  "Research synthesis and source trails",
  "Product strategy and planning notes",
];

const SUBJECTS = [
  "Retrieval practice",
  "A spaced repetition schedule",
  "A map of content",
  "Progressive summarization",
  "The zettelkasten method",
  "An atomic note boundary",
  "The limit of working memory",
  "Deliberate practice",
  "A shared vocabulary",
  "An interface affordance",
  "Legacy migration work",
  "Continuous delivery",
  "A design review ritual",
  "An incident retrospective",
  "The cost of coordination",
  "Documentation as a product",
  "Feature flag hygiene",
  "A well-scoped experiment",
  "Onboarding friction",
  "Estimation error",
  "Technical debt",
  "An observability budget",
  "The attention of a reviewer",
  "Naming things well",
  "A durable interface contract",
];

const PREDICATES = [
  "beats",
  "outlasts",
  "quietly undermines",
  "predicts",
  "costs more than",
  "is worth more than",
  "rarely survives",
  "compounds into",
  "trades away",
  "makes room for",
];

const OBJECTS = [
  "rereading the source",
  "raw enthusiasm",
  "a longer planning cycle",
  "the first draft of a system",
  "any amount of tooling",
  "the patience of a second reader",
  "the shared context of a team",
  "an afternoon of debugging",
  "a clean dependency graph",
  "the release you actually ship",
  "unwritten conventions",
  "the roadmap for next quarter",
  "a confident guess",
  "steady incremental progress",
  "one more meeting",
  "the shape of the codebase",
  "a reader who arrives late",
  "the intent behind a change",
  "every clever abstraction",
  "a decision nobody recorded",
];

/** Distinct titles the banks can compose. */
export const TITLE_CAPACITY = SUBJECTS.length * PREDICATES.length * OBJECTS.length;

// Stepping by a value coprime with the capacity walks every combination
// exactly once, so consecutive indices vary all three banks instead of
// exhausting the first one before touching the second.
const STRIDE = 3121;

function greatestCommonDivisor(a, b) {
  return b === 0 ? a : greatestCommonDivisor(b, a % b);
}

if (greatestCommonDivisor(STRIDE, TITLE_CAPACITY) !== 1) {
  throw new Error("stress vault: title stride must be coprime with the bank capacity");
}

/**
 * The title of note `index`, unique for every index below `TITLE_CAPACITY`.
 * Titles repeat across brains by design: a cross-brain link names a title in
 * another brain, and filenames only have to be unique within one brain.
 */
export function noteTitle(index) {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`stress vault: note index must be a non-negative integer, got ${index}`);
  }
  if (index >= TITLE_CAPACITY) {
    throw new Error(
      `stress vault: only ${TITLE_CAPACITY} distinct titles can be composed, asked for index ${index}`,
    );
  }
  const key = (index * STRIDE) % TITLE_CAPACITY;
  const subject = SUBJECTS[key % SUBJECTS.length];
  const predicate = PREDICATES[Math.floor(key / SUBJECTS.length) % PREDICATES.length];
  const object = OBJECTS[Math.floor(key / (SUBJECTS.length * PREDICATES.length)) % OBJECTS.length];
  return `${subject} ${predicate} ${object}`;
}

export function brainId(index) {
  const id = BRAIN_IDS[index];
  if (!id) throw new Error(`stress vault: no brain at index ${index}`);
  return id;
}

export function brainTitle(index) {
  const title = BRAIN_TITLES[index];
  if (!title) throw new Error(`stress vault: no brain at index ${index}`);
  return title;
}

/**
 * The canvas label a workspace graph composes for a note: a status marker, the
 * owning brain, and the title. This is the string whose width the fixture
 * exists to stress, so the test that guards the distribution measures it.
 */
export function composedWorkspaceLabel(brainIndex, noteIndex, marker = "◆") {
  return `${marker} @${brainId(brainIndex)} · ${noteTitle(noteIndex)}`;
}
