varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vPositionW;
varying vec3 vNormalW;
attribute vec3 color;
varying vec3 vColor;
varying vec4 viewerUV;

uniform vec3 targetPos;
uniform float downDistance;
uniform float downEdge;

${Ha}

void main() {
  vPosition = position;
  vNormal = normalMatrix * normal;
  vPositionW = vec3( modelMatrix*vec4( position, 1.0 ));
  vNormalW = normalize( vec3( vec4( normal, 0.0 ) * modelMatrix ) );
  vUv = uv;
  //UV是反的
  vUv.y = 1.0 - vUv.y;
  vColor=color;

  #ifdef USE_INSTANCING
    vPositionW = vec3(instanceMatrix * vec4(vPositionW,1.));
  #endif

  #ifdef USE_INSTANCING
    vPosition = vec3(instanceMatrix * vec4(vPosition,1.));
  #endif
  
  // gl_Position = projectionMatrix * modelViewMatrix * vec4(vPosition, 1.0);
  viewerUV = projectionMatrix*modelViewMatrix * vec4(vPosition, 1.0);
  viewerUV = vec4((viewerUV.xyz / viewerUV.w).xy* 0.5 + 0.5,0.,1.);
  // viewerUV = vec4(gl_Position.xyz/10.,1.);
  // viewerUV = modelViewMatrix * vec4( position, 1.0 );

    //下降
    float depth = length(vPositionW-targetPos);
    // depth = pow(depth,2.);

    float fogFactor = smoothstep( downDistance, downDistance+downEdge, depth );

    // float fogFactor = 1.0 - exp( - 100. * 100. * depth * depth );
    // float fogFactor = 1.-exp(-(depth*0.000006));
    float fogNoise = clamp(noise3d(vPositionW*vec3(0.03)),0.,1.);
    fogNoise=clamp(fogNoise-1.+(1.-fogFactor)*3.,0.,1.);

    //根据过程，修改顶点位置(从下往上冒出的效果)
    float distanceToTarget = length(vPositionW-targetPos);
    //下降高度
    float downMask = clamp(downDistance-distanceToTarget,0.,80.)/80.;
    // float downLen = (downMask-1.)*50.;
    downMask = fogNoise;
    vec3 cPosition = vec3(vPosition.x,vPosition.y*downMask,vPosition.z);
    // vPosition = 
    cPosition.y -= 1.*(1.-downMask);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(cPosition, 1.0);
}