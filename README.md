# three-xr-controller
 
VR controller.

## Features
* Locomotion
  * Snap turn
  * Teleport
* Pointer event handling. (hover, down, up, leave)

 ![preview](https://user-images.githubusercontent.com/20784450/213610773-9b7e0eee-9eb3-4157-90d7-69923aeb2ea9.gif)


## Example
```bash
npm run example
```

## Installation
### npm
```bash
npm install @verseengine/three-xr-controller
```

### CDN (ES Mobules)
```html
<script
      async
      src="https://cdn.jsdelivr.net/npm/es-module-shims@1.6.2/dist/es-module-shims.min.js"
    ></script>
<script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.137.0/build/three.module.js",
      "three-xr-controller": "https://cdn.jsdelivr.net/npm/@verseengine/three-xr-controller@1.0.0/dist/esm/index.js"
    }
  }
</script>
```

## Usage
```javascript
import * as THREE from "three";
import { DefaultXrControllerSet } from "three-xr-controller";

const collisionObjects:Object3D[] = [wall0, wall1, table, ...];
const interactableObjects:Object3D[] = [button0, door0, ...]; 
const teleportTargetObjects:Object3D[] = [ground0, ...]; 
const person:Object3D = ...;
const camera:THREE.PerspectiveCamera = ...;
const cameraOffset:Object3D = ...;
cameraOffset.position.set(0, 1.6, 0);
cameraOffset.add(camera);
person.add(cameraOffset);

const xrControllerSet = new DefaultXrControllerSet(
  renderer.xr,
  scene,
  cameraOffset,
  person,
  person,
  {
    getCollisionObjects: () => collisionObjects,
    getInteractableObjects: () => interactableObjects,
    getTeleportTargetObjects: () => teleportTargetObjects,
    onSelectUp: (interactableObject) => {
      ...
    }
  }
);

xrControllerSet.enabled = renderer.xr.isPresenting;
renderer.xr.addEventListener("sessionstart", async () => {
  const camera = renderer.xr.getCamera();

  // wait for vr camera
  while (Math.round(renderer.xr.getCamera().position.y * 10) === 0) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  // Laser pointer is displayed only on the first-person camera
  const firstPersonOnlyLayer = 9;
  const thirdPersonOnlyLayer = 10;
  for (const c of [camera, ...(camera.cameras || [])]) {
    c.layers.enable(firstPersonOnlyLayer);
    c.layers.disable(thirdPersonOnlyLayer);
  }

  xrControllerSet.enabled = true;
});
renderer.xr.addEventListener("sessionend", () => {
  xrControllerSet.enabled = false;
});
```

# Reference

## API Reference
[Link](docs/three-xr-controller.md)
