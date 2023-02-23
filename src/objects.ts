import * as THREE from "three";

type Disposable = { dispose(): void };

class Tmps {
  vec: THREE.Vector3;
  constructor() {
    this.vec = new THREE.Vector3();
  }
}
let _tmps: Tmps;

export class PointerBall {
  object3D: THREE.Object3D;
  _disposables: Disposable[] = [];

  constructor() {
    const g = new THREE.SphereGeometry(0.03, 16, 16);
    const m = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this._disposables.push(g);
    this._disposables.push(m);
    const inner = new THREE.Mesh(g, m);

    const m1 = new THREE.MeshBasicMaterial({
      color: 0x111111,
      side: THREE.BackSide,
    });
    this._disposables.push(m1);
    const outer = new THREE.Mesh(g, m1);
    outer.scale.multiplyScalar(1.05);

    this.object3D = new THREE.Group();
    this.object3D.add(inner);
    this.object3D.add(outer);
    this.object3D.name = "pointerBall";
  }
  dispose() {
    this._disposables.forEach((v) => v.dispose());
    this.object3D.removeFromParent();
  }
}
export class PointerLine {
  object3D: THREE.Line;
  _disposables: Disposable[] = [];
  _defaultMaterial: THREE.Material;
  _hitMaterial: THREE.Material;
  _hit = false;

  constructor() {
    if (!_tmps) {
      _tmps = new Tmps();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([0, 0, 0, 0, 1, 0], 3)
    );
    g.setAttribute(
      "color",
      new THREE.Float32BufferAttribute([0.5, 0.5, 0.5, 0, 0, 0], 3)
    );
    this._disposables.push(g);

    this._defaultMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
    });
    this._disposables.push(this._defaultMaterial);

    this._hitMaterial = new THREE.LineBasicMaterial({
      color: 0x00ffff,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
    });
    this._disposables.push(this._hitMaterial);

    this.object3D = new THREE.Line(g, this._defaultMaterial);
    this.object3D.name = "pointerLine";
  }
  dispose() {
    this._disposables.forEach((v) => v.dispose());
    this.object3D.removeFromParent();
  }
  get hit() {
    return this._hit;
  }
  set hit(v: boolean) {
    v = !!v; // convert to boolean
    if (v === this._hit) {
      return;
    }
    this._hit = v;
    if (this._hit) {
      this.object3D.material = this._hitMaterial;
    } else {
      this.object3D.material = this._defaultMaterial;
    }
  }
  setDirection(direction: THREE.Vector3) {
    const axis = _tmps.vec.set(direction.z, 0, -direction.x).normalize();
    const angle = Math.acos(direction.y);
    this.object3D.quaternion.setFromAxisAngle(axis, angle);
  }
}

export class TeleportPoint {
  object3D: THREE.Object3D;
  _disposables: Disposable[] = [];
  constructor() {
    const res = new THREE.Group();
    res.name = "teleportPoint";

    const color = 0x4d93fd;
    {
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(0.25, 0.01, 12, 48),
        new THREE.MeshBasicMaterial({
          color,
          side: THREE.DoubleSide,
        })
      );
      torus.rotation.x = THREE.MathUtils.degToRad(90);
      res.add(torus);
      this._disposables.push(torus.material);
      this._disposables.push(torus.geometry);
    }
    {
      const loader = new THREE.TextureLoader();
      const texture = loader.load(cylinderTexture);
      const cylinder = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.25, 0.3, 32, 1, false),
        new THREE.MeshBasicMaterial({
          color,
          map: texture,
          depthTest: false,
          opacity: 0.5,
          transparent: true,
          side: THREE.DoubleSide,
        })
      );
      cylinder.position.y = 0.3 / 2;
      res.add(cylinder);
      this._disposables.push(texture);
      this._disposables.push(cylinder.material);
      this._disposables.push(cylinder.geometry);
    }
    {
      const w = 0.2;
      const h = 0.2;
      const shape = new THREE.Shape();
      shape.moveTo(w / 2, 0);
      shape.lineTo(0, h);
      shape.lineTo(-w / 2, 0);
      shape.lineTo(w / 2, 0);

      const pointer = new THREE.Mesh(
        new THREE.ExtrudeGeometry(shape, {
          steps: 2,
          depth: 0.05,
          bevelEnabled: false,
        }),
        new THREE.MeshBasicMaterial({
          color,
          depthTest: false,
          opacity: 0.6,
          transparent: true,
          side: THREE.DoubleSide,
        })
      );
      pointer.rotation.set(
        THREE.MathUtils.degToRad(90),
        THREE.MathUtils.degToRad(180),
        0
      );
      pointer.position.set(0, 0.05, 0.25 * -1.5);
      res.add(pointer);
      this._disposables.push(pointer.material);
      this._disposables.push(pointer.geometry);
    }
    this.object3D = res;
  }
  dispose() {
    this._disposables.forEach((v) => v.dispose());
    this.object3D.removeFromParent();
  }
}
const cylinderTexture =
  "data:image/png;base64,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";
