varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vPositionW;
varying vec3 vNormalW;

varying vec3 test;

uniform sampler2D tColor;
uniform vec3 targetPos;
${Ha}
${Rl}
${f8}


void main() {
    vec4 col = texture(tColor,vUv);

    float mask = screenHash();
    float distanceToCamera = distance(cameraPosition.xyz,vPositionW);

    distanceToCamera = smoothstep(10.,30.,distanceToCamera);
    float dither = clamp(distanceToCamera+mask,0.,1.) * distanceToCamera;
    
    if (dither < 0.2) discard;

    gl_FragColor = vec4(col.rgb * mix(0.9, 1., mask), col.a);
    ${Pl}
}