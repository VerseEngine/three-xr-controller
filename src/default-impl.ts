import type * as THREE from "three";
import { initXRControllers, HandHolder } from "./xr-controller";
import { SnapTurnController } from "./snap-turn-controller";
import {
  PointerController,
  PointerControllerOptions,
} from "./pointer-controller";

const DEFAULT_INTERVAL_SEC = 1 / 30; // 30fps

/**
 * Default implementation using PointerController and SnapTurnController.
 */
export class DefaultXrControllerSet {
  private _handHolder?: HandHolder;
  private _snapTurnControllerL: SnapTurnController;
  private _snapTurnControllerR: SnapTurnController;
  private _pointerControllerL: PointerController;
  private _pointerControllerR: PointerController;
  private _pointerHideCount = 0;
  private _enabled = true;
  private _isNonVRMode = false;
  private _intervalSec = 0;
  private _sec = 0;

  /**
   *
   * @param camera - Non-VR Camera
   * @param handContainer - Where to add the XR Controller.
   * @param moveTarget - Object to teleport.
   * @param rotationTarget - Object to snap turn.
   */
  constructor(
    renderer: THREE.WebGLRenderer,
    camera: THREE.Camera,
    scene: THREE.Scene,
    handContainer: THREE.Object3D,
    moveTarget: THREE.Object3D,
    rotationTarget: THREE.Object3D,
    options?: PointerControllerOptions
  ) {
    this._intervalSec =
      options?.intervalSec || options?.intervalSec === 0
        ? options.intervalSec
        : DEFAULT_INTERVAL_SEC;
    if (options?.intervalSec) {
      options.intervalSec = 0;
    }

    // AFrame library sets non-WebXRManager instances in renderer.xr.
    if (navigator.xr && renderer.xr) {
      this._handHolder = initXRControllers(renderer.xr, handContainer);
    }
    this._snapTurnControllerL = new SnapTurnController(rotationTarget, {
      onTurn: () => this._onTurn(),
    });
    this._snapTurnControllerR = new SnapTurnController(rotationTarget, {
      onTurn: () => this._onTurn(),
    });
    const createPointerController = () =>
      new PointerController(renderer, camera, scene, moveTarget, options);
    this._pointerControllerL = createPointerController();
    this._pointerControllerR = createPointerController();
    this._pointerControllerL.enabled = false;
    this._pointerControllerR.enabled = true;
  }
  /**
   *  Object for accessing the raw XR controller.
   */
  get handHolder() {
    return this._handHolder;
  }
  /**
   * Must be called periodically.
   *
   * @param deltaTime - `THREE.Clock.getDelta()`
   *
   * @example
   * ```ts
   * const clock = new THREE.Clock();
   * renderer.setAnimationLoop(() => {
   *   const dt = clock.getDelta();
   *   xrControllers.tick(dt);
   * });
   * ```
   * or
   * ```ts
   * const clock = new THREE.Clock();
   * setInterval(() => {
   *   const dt = clock.getDelta();
   *   xrControllers.tick(dt);
   * }, anything);
   * ```
   */
  tick(deltaTime: number) {
    if (!this._enabled) {
      return;
    }

    this._sec += deltaTime;
    if (this._sec < this._intervalSec) {
      return;
    }
    this._sec = 0;

    const { leftHand, rightHand, leftGamepad, rightGamepad } =
      this._handHolder || {};

    if (this._pointerControllerL.enabled) {
      if (leftGamepad) {
        if (
          rightGamepad &&
          leftGamepad.axes.every((v) => v == 0) &&
          leftGamepad.buttons.every((v) => !v.pressed) &&
          (!rightGamepad.axes.every((v) => v == 0) ||
            !rightGamepad.buttons.every((v) => !v.pressed))
        ) {
          this._pointerControllerL.enabled = false;
          this._pointerControllerR.enabled = true;
        }
      } else if (rightGamepad) {
        this._pointerControllerL.enabled = false;
        this._pointerControllerR.enabled = true;
      }
    } else if (this._pointerControllerR.enabled) {
      if (rightGamepad) {
        if (
          leftGamepad &&
          rightGamepad.axes.every((v) => v == 0) &&
          rightGamepad.buttons.every((v) => !v.pressed) &&
          (!leftGamepad.axes.every((v) => v == 0) ||
            !leftGamepad.buttons.every((v) => !v.pressed))
        ) {
          this._pointerControllerL.enabled = true;
          this._pointerControllerR.enabled = false;
        }
      } else if (leftGamepad) {
        this._pointerControllerL.enabled = true;
        this._pointerControllerR.enabled = false;
      }
    }

    if (leftGamepad) {
      this._snapTurnControllerL.tick(leftGamepad.axes);
    }
    if (rightGamepad) {
      this._snapTurnControllerR.tick(rightGamepad.axes);
    }
    this._pointerControllerL.tick(deltaTime, leftHand);
    this._pointerControllerR.tick(deltaTime, rightHand);
  }
  private _onTurn() {
    this._pointerHideCount++;

    if (this._pointerHideCount === 1) {
      this._pointerControllerR.hidePointerLine();
      this._pointerControllerL.hidePointerLine();
      const f = () => {
        if (this._pointerHideCount === 1) {
          this._pointerHideCount = 0;
          this._pointerControllerR.resetPointerLineVisible();
          this._pointerControllerL.resetPointerLineVisible();
        } else {
          this._pointerHideCount = 1;
          setTimeout(f, 200);
        }
      };
      setTimeout(f, 200);
    }
  }
  /**
   * When set to false, Will not respond to controls. Default is true.
   */
  get enabled() {
    return this._enabled;
  }
  set enabled(v: boolean) {
    v = !!v; // convert to boolean
    if (this._enabled === v) {
      return;
    }
    this._enabled = v;
    this._updateState();
  }
  /**
   * Set to non-VR mode.
   * @remarks
   * In non-VR mode, teleport and rotation do not work.
   */
  setNonVRMode(v: boolean) {
    v = !!v; // convert to boolean
    if (this._isNonVRMode === v) {
      return;
    }
    this._isNonVRMode = v;
    this._updateState();
  }
  private _updateState() {
    this._pointerControllerL.enabled = false;
    this._pointerControllerR.enabled = this._enabled;
    this._snapTurnControllerL.enabled = this._enabled && !this._isNonVRMode;
    this._snapTurnControllerR.enabled = this._enabled && !this._isNonVRMode;
    this._pointerControllerL.setNonVRMode(this._isNonVRMode);
    this._pointerControllerR.setNonVRMode(this._isNonVRMode);
  }
  /**
   * Releases all resources allocated by this instance.
   */
  dispose() {
    this._pointerControllerL.dispose();
    this._pointerControllerR.dispose();
  }
}
