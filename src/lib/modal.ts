/** Native modal blocks the whole document, including the header and skip link. */
export function manageModal(node: HTMLDialogElement) {
  const previous = node.ownerDocument.activeElement as HTMLElement | null;
  node.showModal();
  const focusable = () =>
    Array.from(
      node.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
      ),
    );
  (
    node.querySelector<HTMLElement>("[data-initial-focus]") ??
    focusable()[0] ??
    node
  ).focus();

  function trapTab(event: KeyboardEvent) {
    if (event.key !== "Tab") return;
    const targets = focusable();
    const first = targets[0],
      last = targets.at(-1);
    const current = node.ownerDocument.activeElement;
    if (!first || !last) {
      event.preventDefault();
      node.focus();
      return;
    }
    if (
      event.shiftKey &&
      (current === first || !targets.includes(current as HTMLElement))
    ) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      (current === last || !targets.includes(current as HTMLElement))
    ) {
      event.preventDefault();
      first.focus();
    }
  }
  node.addEventListener("keydown", trapTab);
  return {
    destroy() {
      node.removeEventListener("keydown", trapTab);
      if (node.open) node.close();
      queueMicrotask(() => {
        if (previous?.isConnected) previous.focus();
      });
    },
  };
}
