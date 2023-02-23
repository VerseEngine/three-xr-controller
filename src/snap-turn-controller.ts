import * as THREE from "three";

const DEFAULT_ACTIVE_THRESHOLD = 0.7;
const DEFAULT_DEACTIVE_THRESHOLD = 0.5;
const DEFAULT_TURN_AMOUNT = 45;

class Tmps {
  vec: THREE.Vector3;
  vec1: THREE.Vector3;
  quat: THREE.Quaternion;
  constructor() {
    this.vec = new THREE.Vector3();
    this.vec1 = new THREE.Vector3();
    this.quat = new THREE.Quaternion();
  }
}
let _tmps: Tmps;

export interface SnapTurnControllerOptions {
  /**
   * Threshold to determine when a gamepad (ex. 3D Stick) is pressed.
   * Default is 0.7.
   */
  activeThreshold?: number;
  /**
   * Threshold for determining when the gamepad (e.g., 3D Stick) is released.
   * Default is 0.5.
   */
  deactiveThreshold?: number;
  /**
   * Radian angle of rotation amount. Default is degToRad(45).
   */
  turnAmount?: number;
  /**
   * Event handler called when SnapTurn is executed.
   */
  onTurn?: () => void;
}

/**
 * Snap turn
 *
 * @example
 * see ./default-impl.ts#DefaultXrControllerSet
 */
export class SnapTurnController {
  private _target: THREE.Object3D;
  private _activeThreshold: number;
  private _deactiveThreshold: number;
  private _turnAmount: number;
  private _onTurn?: () => void;
  private _direction = 0;
  private _enabled = true;

  /**
   * @param target - Object to rotation.
   */
  constructor(target: THREE.Object3D, options?: SnapTurnControllerOptions) {
    if (!_tmps) {
      _tmps = new Tmps();
    }
    this._target = target;
    this._activeThreshold =
      options?.activeThreshold || DEFAULT_ACTIVE_THRESHOLD;
    this._deactiveThreshold =
      options?.deactiveThreshold || DEFAULT_DEACTIVE_THRESHOLD;
    this._turnAmount =
      options?.turnAmount || THREE.MathUtils.degToRad(DEFAULT_TURN_AMOUNT);
    this._onTurn = options?.onTurn;
  }
  /**
   * Must be called periodically.
   *
   * @param axes - {@link https://developer.mozilla.org/en-US/docs/Web/API/Gamepad/axes | Gamepad.axes}
   * @example
   * ```ts
   * renderer.setAnimationLoop(() => {
   *   snapTurnController.tick(leftGamepad.axes);
   * });
   * ```
   * or
   * ```ts
   * setInterval(() => {
   *   snapTurnController.tick(leftGamepad.axes);
   * }, anything);
   * ```
   */
  tick(
    axes: number[] | ReadonlyArray<number> // Gamepad.axes
  ) {
    if (!this._enabled) {
      return;
    }
    const n = axes.length;
    if (n === 0) {
      return;
    }
    const amount = n > 2 ? axes[2] : axes[0];
    if (this._direction === 0) {
      if (Math.abs(amount) < this._activeThreshold) {
        return;
      }
      const dir = amount > 0 ? 1 : -1;
      this._direction = dir;
      this.snapTurn(dir);
    } else {
      if (Math.abs(amount) > this._deactiveThreshold) {
        return;
      }
      this._reset();
      return;
    }
  }
  /**
   * Execute SnapTurn directly
   */
  snapTurn(direction: -1 | 1) {
    const sin = Math.sin(this._turnAmount * direction);
    const cos = Math.cos(this._turnAmount * direction);
    const x = 0;
    const z = 1;
    const dir = _tmps.vec.set(x * cos - z * sin, 0, x * sin + z * cos);

    const targetQuat = this._target.getWorldQuaternion(_tmps.quat);
    this._target
      .getWorldPosition(_tmps.vec1)
      .add(dir.applyQuaternion(targetQuat).multiplyScalar(1));
    this._target.lookAt(_tmps.vec1);
    this._onTurn?.();
  }
  /**
   * When set to false, Will not respond to controls. Default is true.
   */
  get enabled() {
    return this._enabled;
  }
  set enabled(v: boolean) {
    v = !!v; // convert to bolean
    if (this._enabled === v) {
      return;
    }
    this._enabled = v;
    this._reset();
  }
  private _reset() {
    this._direction = 0;
  }
}
