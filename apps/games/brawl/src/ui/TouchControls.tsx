import type { InputAction } from "../game/types";

interface TouchControlsProps {
  onCommand: (action: InputAction) => void;
  onHold: (action: InputAction, pressed: boolean) => void;
}

/** On-screen movement + attack pad. Shared by Duel and Arena. */
export function TouchControls({ onCommand, onHold }: TouchControlsProps) {
  return (
    <fieldset className="touch-controls" aria-label="Fight controls">
      <div className="touch-cluster">
        <HoldButton label="Left" onHold={(pressed) => onHold("left", pressed)} />
        <HoldButton label="Right" onHold={(pressed) => onHold("right", pressed)} />
        <button type="button" onClick={() => onCommand("jump")}>
          Jump
        </button>
        <HoldButton label="Guard" onHold={(pressed) => onHold("guard", pressed)} />
      </div>
      <div className="touch-cluster">
        <button type="button" onClick={() => onCommand("light")}>
          Light
        </button>
        <button type="button" onClick={() => onCommand("heavy")}>
          Heavy
        </button>
        <button type="button" onClick={() => onCommand("special")}>
          Special
        </button>
      </div>
    </fieldset>
  );
}

interface HoldButtonProps {
  label: string;
  onHold: (pressed: boolean) => void;
}

function HoldButton({ label, onHold }: HoldButtonProps) {
  return (
    <button
      type="button"
      onPointerDown={() => onHold(true)}
      onPointerUp={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
      onPointerLeave={() => onHold(false)}
    >
      {label}
    </button>
  );
}
