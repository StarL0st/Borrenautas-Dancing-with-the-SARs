// A satellite circling the globe. It is a decoration: the orbit has NISAR's tilt, but the
// position, height and size are not real (a true-to-scale satellite would be invisible).
import type { CustomLayerInterface, Map } from "maplibre-gl";
import meshUrl from "./assets/satellite.bin?url";

const ALTITUDE = 0.22; // above the surface, in Earth radii (the real orbit is 0.12)
const SIZE = 0.08; // half the model's length, in Earth radii
const LAP_S = 90; // seconds per orbit on screen (the real one takes about 100 minutes)
const DRIFT_S = 1500; // seconds for the track to shift once around the Earth
const INCLINATION = (98.4 * Math.PI) / 180;
const FADE_ZOOM = [3.6, 4.4]; // fades out while zooming in: up close it would fill the screen

const VERTEX = `#version 300 es
in vec3 a_pos;
uniform mat4 u_matrix;
uniform vec3 u_origin;
uniform mat3 u_basis;
out vec3 v_world;
out vec3 v_model;
void main() {
  v_model = a_pos;
  v_world = u_origin + u_basis * a_pos;
  gl_Position = u_matrix * vec4(v_world, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
in vec3 v_world;
in vec3 v_model;
uniform vec3 u_cam;
uniform float u_alpha;
uniform float u_blueprint;
out vec4 color;
void main() {
  // The planet is a unit sphere: hide what sits behind it as seen from the camera.
  vec3 d = v_world - u_cam;
  float a = dot(d, d), b = dot(u_cam, d), c = dot(u_cam, u_cam) - 1.0;
  float disc = b * b - a * c;
  if (disc > 0.0) {
    float hit = (-b - sqrt(disc)) / a;
    if (hit > 0.0 && hit < 1.0) discard;
  }
  // The mesh has no normals or materials: facets are lit from the camera, and the wings
  // (the far ends of the long axis) are painted as solar panels.
  vec3 n = normalize(cross(dFdx(v_world), dFdy(v_world)));
  float light = 0.3 + 0.7 * abs(dot(n, normalize(d)));
  vec3 painted = abs(v_model.z) > 0.36 ? vec3(0.16, 0.3, 0.62) : vec3(0.95, 0.93, 0.9);
  // Technical mode draws it as a blueprint: pale grid lines over a dim blue body.
  vec3 cell = abs(fract(v_model * 7.0) - 0.5);
  vec3 blueprint = mix(vec3(0.07, 0.2, 0.3), vec3(0.56, 0.69, 0.78), step(0.42, max(cell.x, max(cell.y, cell.z))));
  vec3 base = mix(painted, blueprint, u_blueprint);
  color = vec4(base * light * u_alpha, u_alpha);
}`;

type Vec = [number, number, number];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// MapLibre's globe: +y is the north pole, +z is longitude 0 on the equator.
const onSphere = (lng: number, lat: number): Vec => [Math.cos(lat) * Math.sin(lng), Math.sin(lat), Math.cos(lat) * Math.cos(lng)];

// Where the satellite is and which way it faces, `t` seconds into the animation.
export function orbit(t: number): { up: Vec; ahead: Vec } {
  const angle = (2 * Math.PI * t) / LAP_S;
  const node = (-2 * Math.PI * t) / DRIFT_S; // longitude where the track crosses the equator
  const n = onSphere(node, 0);
  const east: Vec = [Math.cos(node), 0, -Math.sin(node)];
  const m: Vec = [east[0] * Math.cos(INCLINATION), Math.sin(INCLINATION), east[2] * Math.cos(INCLINATION)];
  const mix = (p: number, q: number) => n.map((v, i) => v * p + m[i] * q) as Vec;
  return { up: mix(Math.cos(angle), Math.sin(angle)), ahead: mix(-Math.sin(angle), Math.cos(angle)) };
}

export function satelliteLayer(map: Map): CustomLayerInterface {
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  let program: WebGLProgram | undefined, vao: WebGLVertexArrayObject | undefined, count = 0;

  return {
    id: "satellite",
    type: "custom",
    renderingMode: "3d",

    async onAdd(_map, gl) {
      const shader = (type: number, source: string) => {
        const s = gl.createShader(type)!;
        gl.shaderSource(s, source);
        gl.compileShader(s);
        return s;
      };
      const p = gl.createProgram()!;
      gl.attachShader(p, shader(gl.VERTEX_SHADER, VERTEX));
      gl.attachShader(p, shader(gl.FRAGMENT_SHADER, FRAGMENT));
      gl.bindAttribLocation(p, 0, "a_pos");
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return console.warn("satellite:", gl.getProgramInfoLog(p));

      // File layout: vertex count, index count (Uint32), Int16 xyz per vertex, Uint16 indices.
      const file = await (await fetch(meshUrl)).arrayBuffer();
      const [verts, indices] = new Uint32Array(file, 0, 2);
      const v = gl.createVertexArray()!;
      gl.bindVertexArray(v);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Int16Array(file, 8, verts * 3), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.SHORT, true, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(file, 8 + (verts * 3 + (verts % 2)) * 2, indices), gl.STATIC_DRAW);
      gl.bindVertexArray(null);
      program = p;
      vao = v;
      count = indices;
      map.triggerRepaint();
    },

    render(gl, { defaultProjectionData: projection }) {
      const zoom = map.getZoom();
      const alpha = Math.min(1, (FADE_ZOOM[1] - zoom) / (FADE_ZOOM[1] - FADE_ZOOM[0]));
      // Only on the round Earth: once the map has flattened there is no orbit to draw.
      if (!program || !vao || alpha <= 0 || projection.projectionTransition < 1) return;

      const { up, ahead } = orbit(still.matches ? 20 : performance.now() / 1000);
      const side = cross(ahead, up);
      // The camera sits where the projection sends x, y and w to zero: three planes, one point.
      const m = projection.mainMatrix;
      const row = (i: number): Vec => [m[i], m[4 + i], m[8 + i]];
      const [r0, r1, r3] = [row(0), row(1), row(3)];
      const [c0, c1, c3] = [cross(r1, r3), cross(r3, r0), cross(r0, r1)];
      const det = r0[0] * c0[0] + r0[1] * c0[1] + r0[2] * c0[2];
      const cam = c0.map((_, k) => -(m[12] * c0[k] + m[13] * c1[k] + m[15] * c3[k]) / det);

      gl.useProgram(program);
      gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_matrix"), false, projection.mainMatrix as Float32Array);
      gl.uniform3fv(gl.getUniformLocation(program, "u_origin"), up.map((x) => x * (1 + ALTITUDE)));
      // Model axes: x points along the track, y away from the Earth, z (the wings) across.
      gl.uniformMatrix3fv(gl.getUniformLocation(program, "u_basis"), false, [...ahead, ...up, ...side].map((x) => x * SIZE));
      gl.uniform3fv(gl.getUniformLocation(program, "u_cam"), cam);
      gl.uniform1f(gl.getUniformLocation(program, "u_alpha"), alpha);
      gl.uniform1f(gl.getUniformLocation(program, "u_blueprint"), document.documentElement.dataset.mode === "technical" ? 1 : 0);
      // The layer is drawn last and hides itself behind the planet, so it can own the depth buffer.
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LESS);
      gl.depthMask(true);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.disable(gl.CULL_FACE);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindVertexArray(vao);
      gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
      gl.bindVertexArray(null);

      if (!still.matches) map.triggerRepaint(); // keep it moving
    },
  };
}
