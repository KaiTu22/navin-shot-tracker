// Immediate visual feedback on tap for every button, independent of how long any
// underlying async write (Firestore) takes to resolve. Uses Pointer Events so
// touch and mouse behave the same, and applies via one delegated listener rather
// than wiring every button individually.
export function installPressFeedback(root = document) {
  const clearAllPressed = () => {
    root.querySelectorAll('button.pressed').forEach((btn) => btn.classList.remove('pressed'));
  };

  root.addEventListener('pointerdown', (event) => {
    const btn = event.target.closest('button');
    if (btn && !btn.disabled) btn.classList.add('pressed');
  });

  root.addEventListener('pointerup', clearAllPressed);
  root.addEventListener('pointercancel', clearAllPressed);
}
