export default `varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vPositionW;
varying vec3 vNormalW;

uniform sampler2D tMask;
uniform vec3 targetPos;

\${Ha}
\${Rl}

void main() {
    //叠加噪波
    float noise = noise3d(vec3(vUv*vec2(15.,0.15),1.0));
    noise = pow(noise+0.5,2.);
    noise = clamp(noise,0.001,1.);
    float mask = texture2D(tMask,vec2(vUv.y*0.1,vUv.x)).x;
    noise=noise*(1.-mask);
    gl_FragColor = vec4(vec3(0.3), noise);
    \${Pl}
}`;
