export default `varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vPositionW;
varying vec3 vNormalW;

uniform sampler2D tBackground;
uniform vec3 targetPos;
uniform float select;
\${Ha}
\${Rl}

void main() {
    //文字贴图
    // float textMask = texture2D(tText,vUv).a;

    // //背景图
    vec4 col = texture2D(tBackground,vUv);
    // col.a = col.a*(smoothstep(60.,80.,cameraPosition.y))*(1.-step(cameraPosition.y,0.));
    // // col.rgb = vec3(0x55,0x00,0x09)/255.;
    // col.rgb = mix(col.rgb,vec3(1.),vec3(textMask));

    gl_FragColor = vec4(vec3(col.rgb),col.a*(smoothstep(60.,80.,cameraPosition.y))*(1.-step(cameraPosition.y,0.)));

    // col.rgb*=(vec3(1.)+vec3(0.2)*select);

    // gl_FragColor = vec4(col);
    \${Pl}

    // gl_FragColor = vec4(vec3(test)/10.,1.);
}`;
