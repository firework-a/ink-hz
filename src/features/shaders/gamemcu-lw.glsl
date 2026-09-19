varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vPositionW;
varying vec3 vNormalW;
varying vec3 vColor;

const float yMax = 32.;
const float yMin = 10.;
const float yMaxV = 0.9;
const float yMinV = 0.0;
const float yDeepMax = 8.8;
const float yDeepMin = 8.;

const vec3 topCol = vec3(0x42,0x60,0x70)/255.;
const vec3 midCol = vec3(0x56,0x80,0x70)/255.;
const vec3 bottomCol = vec3(0xbc,0xbc,0xb8)/255.;
const vec3 fresnelTopCol = vec3(0.723,0.850,0.810);
const vec3 fresnelCol = vec3(0.340,0.454,0.422);
const vec3 noiseGlobalCol = vec3(0.080,0.144,0.162);
const vec3 vertexCol0 = vec3(0x85,0x98,0x97)/255.;
const vec3 vertexCol1 = vec3(0x91,0x9f,0x9b)/255.;
const vec3 darkCol = vec3(96,134,130)/255.;
uniform vec3 targetPos;

${Ha}
${rw}
${Rl}
${aw}

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

void main() {
    //叠加世界位置(位置上添加法线平滑)
    float yMask = 1.-clamp(((vPositionW).y-yMin)/(yMax - yMin),0.,1.);
    float yBaseCol = mix(yMaxV,yMinV,yMask);

    vec4 edge = textureEdge(vPositionW.xz);

    //叠加菲涅尔
	float fresnel_global = edge.r < 0.9 ? 0.: fresnel(8.3);

    //叠加噪波
    float noise = noise3d(vPositionW*vec3(0.8));
    float noiseTransit = mix(yMaxV,yMinV,noise);
    // noiseTransit = mix(yBaseCol,noiseTransit,yMask);
    // noiseTransit = mix(noiseTransit,1.,pow(yMask,2.));
    //混合顶部
    noiseTransit = mix(yBaseCol,noiseTransit,yMask);
    noiseTransit = mix(noiseTransit,yBaseCol,pow(yMask,2.));

    //topCol混合一点fresnel
    float fresnel_topCol=clamp(fresnel(6.),0.,1.)*0.6;
    vec3 topColFre = mix(topCol,fresnelTopCol,vec3(fresnel_topCol));

    vec3 col = mix(midCol,topColFre,noiseTransit);
    col = mix(col,bottomCol,pow(yMask,3.));
    col = mix(col,fresnelCol,fresnel_global*(1.-noiseTransit));

    // //混合噪点和顶点色
    // float noise_global = clamp(noise3d(vPosition*vec3(0.002,0.004,0.001)),0.,1.)*0.2;
    // col = mix(col,noiseGlobalCol,noise_global);

    // float vertexColMask = (1.-vColor.b)*0.5;
    float vertexColMask = (1.-vColor.b)*0.8;
    float noise_vertex = clamp(noise3d(vPositionW*vec3(0.0083,0.023,0.04)*vec3(10.))+0.6,0.,1.);
    vec3 vertexCol = mix(vertexCol0,vertexCol1,noise_vertex);
    vertexCol = mix(col,vertexCol,yMask);

    col = mix(col,vertexCol,vertexColMask);

    //最终混合底部
    col = mix(darkCol, col,smoothstep(8.,10.,vPositionW.y));

    gl_FragColor = vec4(vec3(col) * mix(.9, 1.,random(gl_FragCoord.xy * 0.05)), 1.0);

    ${Pl}
}