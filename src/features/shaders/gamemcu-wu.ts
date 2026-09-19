export default `varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vPositionW;
varying vec3 vNormalW;
varying vec4 viewerUV;

void main() {
    vPosition = position;
    vNormal = normalMatrix * normal;
    vPositionW = vec3( modelMatrix*vec4( position, 1.0 ));
    vNormalW = normalize( vec3( vec4( normal, 0.0 ) * modelMatrix ) );
    vUv = uv;
      //UV是反的
    // vUv.y = 1.0 - vUv.y;

    #ifdef USE_INSTANCING
      vPositionW = vec3(instanceMatrix * vec4(vPositionW,1.));
    #endif

    #ifdef USE_INSTANCING
      vPosition = vec3(instanceMatrix * vec4(vPosition,1.));
    #endif


    // 添加面向摄像机的代码
    // vec3 vPosition = position;
    vec3 instancePosition = vec3(modelMatrix * vec4(vec3(0.),1.));
    #ifdef USE_INSTANCING
      instancePosition = vec3(instanceMatrix * vec4(vec3(0.),1.));
    #endif

    // vec3 normalFace = vec3(0.,1.,0.);
    // vec3 vcV = cross( cameraPosition.xyz - instancePosition, normalFace );
    // vec3 vcU = normalize( cross( cameraPosition.xyz - instancePosition, vcV ) );
    // vcV = normalize( vcV );

    // vec3 vcN = normalize(cross( vcU, vcV ));
    // // mat3 viewMatrix = mat3( vcU, vcN, -vcV );
    // mat3 viewMatrix = mat3( -vcV, -vcU, -vcN );

    vec3 normalFace = vec3(0.,1.,0.);
    vec3 cameraDir = normalize(cameraPosition.xyz - instancePosition);
    vec3 vcV = cross( normalFace,cameraDir );
    vec3 vcU = normalFace;
    vec3 vcN = cross( vcV,vcU );
    mat3 rotateMatrix = mat3( vcV, vcU, vcN );
    
    vec3 mvPosition = rotateMatrix * position;
    #ifdef USE_INSTANCING
      mvPosition.xyz += instancePosition;
    #endif
    gl_Position = projectionMatrix * modelViewMatrix * vec4(mvPosition, 1.0);
    viewerUV = gl_Position;
    viewerUV = vec4((viewerUV.xyz / viewerUV.w).xy* 0.5 + 0.5,0.,1.);
}`;
