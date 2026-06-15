# Web Platform Lookup

**Task:** "Add a modal dialog that closes when you click the backdrop."

Rung 3 of the ladder is "native platform feature covers it?" On web work the
trap is that the agent forgets what the platform already does (a date input,
dialog, popover, view transition, container query) and reaches for a library.
When a web task turns on whether the platform covers it and the optional
[Modern Web Guidance](https://github.com/GoogleChrome/modern-web-guidance)
`modern-web` CLI is on hand, rung 3 gets a lookup:
`modern-web search "modal dialog light dismiss"`. Not installed? Skip it, the
ladder runs fine without it. This is a lookup, not part of the always-on
ruleset.

## Without Ponytail

```bash
npm install @radix-ui/react-dialog
```

```jsx
import * as Dialog from "@radix-ui/react-dialog";

export default function Modal({ open, onOpenChange, children }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="content">
          {children}
          <Dialog.Close className="close">×</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

A dependency, a portal, an overlay node, and controlled open state, to put a
box on top with a backdrop.

## With Ponytail

`modern-web search "modal dialog light dismiss"` →
`modern-web retrieve light-dismiss-a-dialog`. The platform has it:

```html
<!-- ponytail: <dialog> + closedby, browser does the backdrop, focus trap, and Esc -->
<dialog closedby="any">
  <p>...</p>
</dialog>
```

```js
document.querySelector("dialog").showModal();
```

**1 dependency + portal/overlay machinery → 0 dependencies + a `<dialog>`.**
The `::backdrop` is free, focus is trapped and restored for you, `Esc` closes
it, and `closedby="any"` adds click-outside dismissal. The browser team did the
work.

## The point

MWG suggests the cutting edge, ponytail keeps only the rung that holds. The
lookup found `light-dismiss-a-dialog`; the ladder took it because it deletes a
dependency. The same search would have offered scroll-driven animations and
view transitions for other tasks, and the ladder would have skipped them when
the task didn't need them. Lookup, not license.
