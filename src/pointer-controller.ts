import * as THREE from "three";

import { PointerBall, PointerLine, TeleportPoint } from "./objects";
import { THREE_VRM_DEFAULT_FIRSTPERSON_ONLY_LAYER } from "./consts";

const DEFAULT_FAR = 5;
const DEFAULT_INTERVAL_SEC = 1 / 30; // 30fps

class Tmps {
  vec: THREE.Vector3;
  vec1: THREE.Vector3;
  quat: THREE.Quaternion;
  euler: THREE.Euler;
  mtx: THREE.Matrix4;
  mtx3: THREE.Matrix3;
  obs: THREE.Object3D[] = [];
  iss: THREE.Intersection<THREE.Object3D>[] = [];
  constructor() {
    this.vec = new THREE.Vector3();
    this.vec1 = new THREE.Vector3();
    this.mtx = new THREE.Matrix4();
    this.mtx3 = new THREE.Matrix3();
    this.quat = new THREE.Quaternion();
    this.euler = new THREE.Euler();
    this.iss = [];
  }
}
let _tmps: Tmps;

type Disposable = { dispose(): void };

export interface PointerControllerOptions {
  /**
   * Get a list of objects that the laser pointer will not penetrate.
   */
  getCollisionObjects?: () => THREE.Object3D[] | undefined;
  /**
   * Get a list of objects that can interact with a laser pointer (Other than teleport destination).
   */
  getInteractableObjects?: () => THREE.Object3D[] | undefined;
  /**
   * Get a list of objects that can be the destination of a teleport.
   */
  getTeleportTargetObjects?: () => THREE.Object3D[] | undefined;
  /**
   * Length of laser pointer. Default is 5.
   */
  far?: number;
  /**
   * Cursor hover event handler. like {@link https://developer.mozilla.org/en-US/docs/Web/API/Element/mouseover_event | mouseover}.
   */
  onCursorHover?: (el: THREE.Object3D) => void;
  /**
   * Cursor leave event handler. like {@link https://developer.mozilla.org/en-US/docs/Web/API/Element/mouseleave_event | mouseleave}.
   */
  onCursorLeave?: (el: THREE.Object3D) => void;
  /**
   * Select button release event handler. like {@link https://developer.mozilla.org/en-US/docs/Web/API/Element/mouseup_event | mouseup}.
   */
  onSelectUp?: (el: THREE.Object3D, point: THREE.Vector3) => void;
  /**
   * Select button press event handler. like {@link https://developer.mozilla.org/en-US/docs/Web/API/Element/mousedown_event | mousedown}.
   */
  onSelectDown?: (el: THREE.Object3D, point: THREE.Vector3) => void;
  /**
   * Processing frequency of tick(). Default is 1 / 30 (30fps).
   */
  intervalSec?: number;
  /**
   * {@link https://threejs.org/docs/#api/en/core/Layers | Layer number } to be displayed only for first-person camera. (Layer numbers that you do not want displayed on mirrors, etc.)
   */
  firstPersonOnlyLayer?: number;
}

/**
 * Interactions and teleport
 *
 * @example
 * see ./default-impl.ts#DefaultXrControllerSet
 */
export class PointerController {
  private _target: THREE.Object3D;
  private _renderer: THREE.WebGLRenderer;
  private _xr?: THREE.WebXRManager;
  private _camera: THREE.Camera;
  private _enabled = true;
  private _isNonVRMode = false;
  private _raycaster: THREE.Raycaster;
  private _mouseRaycaster: THREE.Raycaster;
  private _teleportPoint: TeleportPoint;
  private _pointerLine: PointerLine;
  private _pointerBall: PointerBall;
  private _disposables: Disposable[] = [];
  private _hitPos: THREE.Vector3;
  private _mousePos: THREE.Vector2;
  private _teleportAngle = 0;
  private _intersectionObject?: THREE.Object3D;

  private _onCursorHover?: (el: THREE.Object3D) => void;
  private _onCursorLeave?: (el: THREE.Object3D) => void;
  private _onSelectUp?: (el: THREE.Object3D, point: THREE.Vector3) => void;
  private _onSelectDown?: (el: THREE.Object3D, point: THREE.Vector3) => void;
  private _getCollisionObjects?: () => THREE.Object3D[] | undefined;
  private _getInteractableObjects?: () => THREE.Object3D[] | undefined;
  private _getTeleportTargetObjects?: () => THREE.Object3D[] | undefined;
  private _hitIsTeleport = false;
  private _intervalSec = 0;
  private _sec = 0;

  /**
   * @param camera - Non-VR Camera
   * @param target - Object to teleport
   */
  constructor(
    renderer: THREE.WebGLRenderer,
    camera: THREE.Camera,
    scene: THREE.Scene,
    target: THREE.Object3D,
    options?: PointerControllerOptions
  ) {
    if (!_tmps) {
      _tmps = new Tmps();
    }
    this._target = target;
    this._renderer = renderer;
    this._xr = renderer.xr;
    this._camera = camera;
    this._mouseRaycaster = new THREE.Raycaster();
    this._raycaster = new THREE.Raycaster();
    this._raycaster.far = options?.far || DEFAULT_FAR;
    this._getCollisionObjects = options?.getCollisionObjects;
    this._getInteractableObjects = options?.getInteractableObjects;
    this._getTeleportTargetObjects = options?.getTeleportTargetObjects;
    this._onCursorHover = options?.onCursorHover;
    this._onCursorLeave = options?.onCursorLeave;
    this._onSelectUp = options?.onSelectUp;
    this._onSelectDown = options?.onSelectDown;
    this._intervalSec =
      options?.intervalSec || options?.intervalSec === 0
        ? options.intervalSec
        : DEFAULT_INTERVAL_SEC;
    this._hitPos = new THREE.Vector3();
    this._mousePos = new THREE.Vector2();

    this._onSessionStart = this._onSessionStart.bind(this);
    this._onSessionEnd = this._onSessionEnd.bind(this);
    this._onDown = this._onDown.bind(this);
    this._onUp = this._onUp.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);

    this._addEventListeners();

    this._teleportPoint = new TeleportPoint();
    this._teleportPoint.object3D.visible = false;
    this._disposables.push(this._teleportPoint);
    scene.add(this._teleportPoint.object3D);

    this._pointerLine = new PointerLine();
    this._pointerLine.hit = false;
    this._pointerLine.object3D.visible = this._enabled;
    this._disposables.push(this._pointerLine);
    scene.add(this._pointerLine.object3D);

    this._pointerBall = new PointerBall();
    this._pointerBall.object3D.visible = false;
    this._disposables.push(this._pointerBall);
    scene.add(this._pointerBall.object3D);

    const firstPersonOnlyLayer =
      options?.firstPersonOnlyLayer || THREE_VRM_DEFAULT_FIRSTPERSON_ONLY_LAYER;
    this._teleportPoint.object3D.traverse((el) => {
      el.layers.set(firstPersonOnlyLayer);
    });
    this._pointerBall.object3D.traverse((el) => {
      el.layers.set(firstPersonOnlyLayer);
    });
    this._pointerLine.object3D.traverse((el) => {
      el.layers.set(firstPersonOnlyLayer);
    });
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
   * In non-VR mode, teleport do not work.
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
    this._pointerLine.object3D.visible = this._enabled && !this._isNonVRMode;
    if (!this._enabled || this._isNonVRMode) {
      this._leave();
    }
  }

  /**
   * Hide laser pointer lines
   */
  hidePointerLine() {
    this._pointerLine.object3D.visible = false;
  }
  /**
   * Turn off `hidePointerLine`
   */
  resetPointerLineVisible() {
    this._pointerLine.object3D.visible = this._enabled;
  }
  /**
   * Releases all resources allocated by this instance.
   */
  dispose() {
    this._removeEventListeners();
    this._disposables.forEach((v) => v.dispose());
  }

  /**
   * Must be called periodically.
   *
   * @param deltaTime - `THREE.Clock.getDelta()`
   * @param rayOrigin - Laser pointer emission source
   *
   * @example
   * ```ts
   * const clock = new THREE.Clock();
   * renderer.setAnimationLoop(() => {
   *   const dt = clock.getDelta();
   *   pointerController.tick(dt, handHolder.leftHand);
   * });
   * ```
   * or
   * ```ts
   * const clock = new THREE.Clock();
   * setInterval(() => {
   *   const dt = clock.getDelta();
   *   pointerController.tick(dt, handHolder.leftHand);
   * }, anything);
   * ```
   */
  tick(
    deltaTime: number, // THREE.Clock.getDelta()
    rayOrigin?: THREE.Object3D
  ) {
    if (!this._enabled) {
      return;
    }
    if (this._isNonVRMode) {
      rayOrigin = this._camera;
    } else if (!rayOrigin) {
      return;
    }

    this._sec += deltaTime;
    if (this._sec < this._intervalSec) {
      return;
    }
    this._sec = 0;

    const [intersection, isTeleportTarget, isInteractableObject] =
      this._updateRay(
        rayOrigin,
        this._getCollisionObjects?.(),
        this._getInteractableObjects?.(),
        this._getTeleportTargetObjects?.()
      );

    if (!intersection) {
      if (this._pointerLine.object3D.scale.y !== 1) {
        this._pointerLine.object3D.scale.y = 1;
      }
      if (this._intersectionObject) {
        this._leave();
      }
      return;
    }

    const distance = rayOrigin
      .getWorldPosition(_tmps.vec)
      .distanceToSquared(intersection.point);
    if (distance < 1) {
      this._pointerLine.object3D.scale.y = distance / 1;
    }

    if (!isTeleportTarget && !isInteractableObject) {
      if (this._intersectionObject) {
        this._leave();
      }
      return;
    }
    if (this._intersectionObject !== intersection.object) {
      if (this._intersectionObject) {
        this._onCursorLeave?.(this._intersectionObject);
      }
      this._intersectionObject = intersection.object;
      this._pointerLine.hit = true;
      if (isTeleportTarget) {
        this._hitIsTeleport = true;
        this._pointerBall.object3D.visible = false;
        this._teleportPoint.object3D.visible = true;
      } else {
        this._hitIsTeleport = false;
        this._pointerBall.object3D.visible = true;
        this._teleportPoint.object3D.visible = false;
      }
      this._onCursorHover?.(this._intersectionObject);
    }

    const hitPos = intersection.point;
    this._hitPos.copy(hitPos);
    if (this._hitIsTeleport) {
      this._teleportAngle = getAngle(rayOrigin);
      this._teleportPoint.object3D.position.copy(hitPos);
      this._teleportPoint.object3D.rotation.set(0, this._teleportAngle, 0);
    } else {
      this._pointerBall.object3D.position.copy(hitPos);
      const scale = Math.max(Math.min(distance / this._raycaster.far, 1), 0.3);
      this._pointerBall.object3D.scale.set(scale, scale, scale);
    }
  }
  private _updateRay(
    rayOrigin: THREE.Object3D,
    collisionObjects?: THREE.Object3D[],
    interactableObjects?: THREE.Object3D[],
    teleportTargetObjects?: THREE.Object3D[]
  ): [THREE.Intersection<THREE.Object3D> | undefined, boolean, boolean] {
    let r: THREE.Raycaster;
    if (this._isNonVRMode) {
      r = this._mouseRaycaster;
      r.setFromCamera(this._mousePos, this._camera);
    } else {
      r = this._raycaster;
      const isNone =
        rayOrigin.position.x === 0 &&
        rayOrigin.position.y === 0 &&
        rayOrigin.position.z === 0;
      if (isNone) {
        return [undefined, false, false];
      }
      const forward = _tmps.vec1
        .set(0, 0, -1)
        .applyMatrix4(
          _tmps.mtx.identity().extractRotation(rayOrigin.matrixWorld)
        )
        .normalize();
      r.set(rayOrigin.getWorldPosition(_tmps.vec), forward);

      this._pointerLine.object3D.position.copy(r.ray.origin);
      this._pointerLine.setDirection(r.ray.direction);
    }

    let hitC: THREE.Intersection<THREE.Object3D> | undefined = undefined;
    let hitI: THREE.Intersection<THREE.Object3D> | undefined = undefined;
    let hitT: THREE.Intersection<THREE.Object3D> | undefined = undefined;
    if (collisionObjects) {
      const res = intersectObjects(r, collisionObjects);
      if (res) {
        hitC = res;
      }
    }
    if (interactableObjects) {
      const res = intersectObjects(r, interactableObjects);
      if (res) {
        hitI = res;
      }
    }
    if (teleportTargetObjects && !this._isNonVRMode) {
      const res = intersectObjects(r, teleportTargetObjects);
      if (res) {
        hitT = res;
      }
    }
    if (hitC) {
      if (hitT && hitC.distance < hitT.distance) {
        hitT = undefined;
      }
      if (hitI && hitC.distance < hitI.distance) {
        hitI = undefined;
      }
    }
    if (hitI) {
      if (hitT) {
        if (hitI.distance < hitT.distance) {
          return [hitI, false, true];
        } else {
          if (this._canTeleport(hitT)) {
            return [hitT, true, false];
          } else {
            return [undefined, false, false];
          }
        }
      }
      return [hitI, false, true];
    } else if (hitT) {
      if (this._canTeleport(hitT)) {
        return [hitT, true, false];
      } else {
        return [undefined, false, false];
      }
    }
    return [hitC, false, false];
  }
  private _canTeleport(intersection: THREE.Intersection<THREE.Object3D>) {
    if (!intersection.face) {
      return false;
    }
    const matrix = _tmps.mtx3.getNormalMatrix(intersection.object.matrixWorld);
    const normal = _tmps.vec1
      .copy(intersection.face.normal)
      .applyMatrix3(matrix)
      .normalize();
    const angle = _tmps.vec.set(0, 1, 0).angleTo(normal);
    return angle <= THREE.MathUtils.degToRad(45);
  }
  private _addEventListeners() {
    this._xr?.addEventListener("sessionstart", this._onSessionStart);
    this._xr?.addEventListener("sessionend", this._onSessionEnd);
    this._renderer.domElement.addEventListener("mousemove", this._onMouseMove);
    this._renderer.domElement.addEventListener("mouseup", this._onUp);
    this._renderer.domElement.addEventListener("mousedown", this._onDown);
  }
  private _removeEventListeners() {
    this._xr?.removeEventListener("sessionstart", this._onSessionStart);
    this._xr?.removeEventListener("sessionend", this._onSessionEnd);
    this._renderer.domElement.removeEventListener(
      "mousemove",
      this._onMouseMove
    );
    this._renderer.domElement.removeEventListener("mouseup", this._onUp);
    this._renderer.domElement.removeEventListener("mousedown", this._onDown);
  }
  private _onSessionStart() {
    this._xr?.getSession()?.addEventListener("selectstart", this._onDown);
    this._xr?.getSession()?.addEventListener("selectend", this._onUp);
  }
  private _onSessionEnd() {
    this._xr?.getSession()?.removeEventListener("selectstart", this._onDown);
    this._xr?.getSession()?.removeEventListener("selectend", this._onUp);
  }
  private _onMouseMove(e: MouseEvent) {
    const el = this._renderer.domElement;
    const x = e.clientX - el.offsetLeft;
    const y = e.clientY - el.offsetTop;
    const w = el.offsetWidth;
    const h = el.offsetHeight;

    this._mousePos.x = (x / w) * 2 - 1;
    this._mousePos.y = -(y / h) * 2 + 1;
  }
  private _onDown() {
    if (!this._enabled) {
      return;
    }
    if (!this._intersectionObject) {
      return;
    }
    if (this._hitIsTeleport) {
      this._teleport();
    } else {
      this._onSelectDown?.(this._intersectionObject, this._hitPos);
    }
  }
  private _onUp() {
    if (!this._enabled) {
      return;
    }
    if (!this._intersectionObject) {
      return;
    }
    if (!this._hitIsTeleport) {
      this._onSelectUp?.(this._intersectionObject, this._hitPos);
    }
  }
  private _teleport() {
    if (!this._enabled) {
      return;
    }
    if (!this._target.parent) {
      return;
    }
    const pos = _tmps.vec.copy(this._hitPos);
    this._target.parent.worldToLocal(pos);
    this._target.position.copy(pos);
    this._target.rotation.set(0, this._teleportAngle, 0);
    this._leave();
  }
  private _leave() {
    if (this._intersectionObject) {
      if (this._enabled) {
        this._onCursorLeave?.(this._intersectionObject);
      }
      this._pointerBall.object3D.visible = false;
      this._teleportPoint.object3D.visible = false;
      this._pointerLine.hit = false;
      delete this._intersectionObject;
    }
  }
}

function intersectObjects(
  r: THREE.Raycaster,
  objects: THREE.Object3D[]
): THREE.Intersection<THREE.Object3D> | undefined {
  _tmps.obs.length = 0;
  const ar = _tmps.obs;
  for (const o of objects) {
    if (isVisible(o)) {
      ar.push(o);
    }
  }
  _tmps.iss.length = 0;
  const res = r.intersectObjects(ar, true, _tmps.iss);
  if (res.length > 0) {
    return res[0];
  }
}

function isVisible(o: THREE.Object3D): boolean {
  if (!o.visible) {
    return false;
  }
  while (o.parent) {
    o = o.parent;
    if (!o.visible) {
      return false;
    }
  }
  return true;
}

function getAngle(el: THREE.Object3D): number {
  const dir = el.getWorldDirection(_tmps.vec);
  return Math.atan2(dir.x, dir.z);
}
