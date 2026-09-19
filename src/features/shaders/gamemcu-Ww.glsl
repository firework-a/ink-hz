varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vPositionW;
varying vec3 vNormalW;

uniform sampler2D tText;
uniform vec3 targetPos;
uniform float select;
${Ha}
${Rl}

float median(in float r, in float g, in float b) {
    return max(min(r, g), min(max(r, g), b));
}

float signedDistance(in vec2 uv) {
    vec4 texel = texture2D(tText, uv);
    return median(texel.r, texel.g, texel.b) - 0.5;
}

void main() {
    //文字贴图
    // float textMask = texture(tText,vUv).a;

    // //背景图
    // vec4 col = texture(tBackground,vUv);
    // col.a = col.a*(smoothstep(60.,80.,cameraPosition.y))*(1.-step(cameraPosition.y,0.));
    // // col.rgb = vec3(0x55,0x00,0x09)/255.;
    // col.rgb = mix(col.rgb,vec3(1.),vec3(textMask));

    float d = signedDistance(vUv);
    float w = fwidth(d);
    float a = smoothstep(-w, w, d+0.4);
    gl_FragColor = vec4(vec3(1.),a*(smoothstep(60.,80.,cameraPosition.y))*(1.-step(cameraPosition.y,0.)));

    // col.rgb*=(vec3(1.)+vec3(0.2)*select);

    // gl_FragColor = vec4(col);
    ${Pl}

    // gl_FragColor = vec4(vec3(test)/10.,1.);
}