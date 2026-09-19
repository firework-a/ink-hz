
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vPositionW;
varying vec3 vNormalW;

uniform vec3 targetPos;
${Ha}
${Rl}

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

void main() {
    float mask = random(gl_FragCoord.xy * 0.05);
    if (mask > 0.8) discard;
    
    float distanceToCamera = distance(cameraPosition.xyz,vPositionW);
    distanceToCamera = smoothstep(10.,50.,distanceToCamera);
    float dither = clamp(distanceToCamera+mask,0.,1.) * distanceToCamera;
    if (dither < 0.2) discard;

    gl_FragColor = vec4(vec3(0.),1.);
    ${Pl}
}