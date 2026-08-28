---
type: permanent
status: established
tags: [demo, pkm]
created: 2026-08-27
---

This public vault demonstrates [[Portable notes]] and attachment publishing.

![[media/diagram.svg|A diagram linking notes, builds, and a static site]]

The same resolver supports a [downloadable reference file](media/reference.txt).

Code remains portable too. Inline code such as `const portable = true` stays compact.

```js
const vault = {
  format: "plain Markdown",
  published: true,
};

const longArchiveUrl = new URL("https://example.com/archive/portable-notes/with/a/path/long/enough/to/require/horizontal-scrolling/on/a/phone-sized-screen");
console.log(vault, longArchiveUrl);
```

An unlabelled fence remains readable as plain code:

```
notes -> build -> static site
```

An unknown language identifier also falls back to plain code:

```brain-demo-unsupported
portable-note := markdown + links + attachments
```
