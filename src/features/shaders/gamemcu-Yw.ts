export default `varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vPositionW;
varying vec3 vNormalW;

void main() {
    vec3 col = vec3(0xEE,0x73,0x45)/255.;
    gl_FragColor = vec4(col, pow(1.-vUv.y,2.));
}`;
