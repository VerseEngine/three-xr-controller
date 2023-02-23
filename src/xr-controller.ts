import type * as THREE from "three";
import { XRControllerModelFactory } from "three/examples/jsm/webxr/XRControllerModelFactory.js";

/**
 * Object for accessing the raw XR controller.
 */
export interface HandHolder {
  leftHand: THREE.XRTargetRaySpace | undefined;
  rightHand: THREE.XRTargetRaySpace | undefined;
  leftGamepad: Gamepad | undefined;
  rightGamepad: Gamepad | undefined;
}

type XREvent = {
  type: THREE.XRControllerEventType;
  data?: XRInputSource;
};

/**
 * Prepare to load XR controller
 * @param xr - `renderer.xr`
 * @param handContainer - Where to add the XR Controller.
 */
export function initXRControllers(
  xr: THREE.WebXRManager,
  handContainer: THREE.Object3D
): HandHolder {
  const controllerModelFactory = new XRControllerModelFactory();
  const handHolder: HandHolder = {
    leftHand: undefined,
    rightHand: undefined,
    leftGamepad: undefined,
    rightGamepad: undefined,
  };
  //
  const initController = (index: number) => {
    const c = xr.getController(index);
    c.addEventListener("connected", function (e: XREvent) {
      if (!e.data || e.data.targetRayMode !== "tracked-pointer") {
        return;
      }
      if (e.data.handedness === "left") {
        handHolder.leftHand = c;
        handHolder.leftGamepad = e.data.gamepad;
      } else if (e.data.handedness === "right") {
        handHolder.rightHand = c;
        handHolder.rightGamepad = e.data.gamepad;
      }
    });
    c.addEventListener("disconnected", function (e) {
      if (!e.data || e.data.targetRayMode !== "tracked-pointer") {
        return;
      }
      if (e.data.handedness === "left") {
        delete handHolder.leftHand;
        delete handHolder.leftGamepad;
      } else if (e.data.handedness === "right") {
        delete handHolder.rightHand;
        delete handHolder.rightGamepad;
      }
    });
    handContainer.add(c);

    const g = xr.getControllerGrip(index);
    g.add(controllerModelFactory.createControllerModel(g));
    handContainer.add(g);
    return [c, g];
  };

  initController(0);
  initController(1);
  return handHolder;
}
