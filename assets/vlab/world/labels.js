// HTML labels that float above stations. They are real buttons, so keyboard and screen-reader
// users can open every station without moving around the 3D room.

import * as THREE from '../vendor/three.js';

export class Labels {
  constructor(container, camera, { occluders, onClick }) {
    this.container = container; this.camera = camera; this.occluders = occluders; this.onClick = onClick;
    this.items = [];
    this.ray = new THREE.Raycaster();
    this.frame = 0;
  }
  add(station, anchor) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'vl-label'; b.textContent = station.title;
    b.setAttribute('aria-label', `Open ${station.title}`);
    b.addEventListener('click', () => this.onClick(station));
    this.container.append(b);
    const item = { station, anchor: new THREE.Vector3(...anchor), el: b, occluded: false };
    this.items.push(item);
    return item;
  }
  hot(station) { for (const it of this.items) it.el.classList.toggle('is-hot', it.station === station); }
  update(offsetX = 0) {
    const cam = this.camera, w = this.container.clientWidth, h = this.container.clientHeight;
    const v = new THREE.Vector3(), camPos = cam.getWorldPosition(new THREE.Vector3());
    const checkOcclusion = (this.frame++ % 6) === 0;
    for (const it of this.items) {
      v.copy(it.anchor).project(cam);
      const dist = camPos.distanceTo(it.anchor);
      const behind = v.z > 1 || v.z < -1;
      let x = (v.x * 0.5 + 0.5) * w - offsetX, y = (-v.y * 0.5 + 0.5) * h;
      if (checkOcclusion && !behind) {
        const dir = it.anchor.clone().sub(camPos).normalize();
        this.ray.set(camPos, dir); this.ray.far = dist - 0.15;
        it.occluded = this.ray.intersectObjects(this.occluders, false).length > 0;
      }
      const hidden = behind || dist > 13 || it.occluded || x < -60 || x > w + 60 || y < -20 || y > h + 60;
      it.el.classList.toggle('is-hidden', hidden);
      it.el.classList.toggle('is-far', dist > 6);
      it.el.tabIndex = hidden ? -1 : 0;
      if (!behind) it.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, calc(-100% - 14px))`;
    }
  }
}
