
#ifdef USE_FOG
    float depth = length(vPositionW-targetPos);
    depth = pow(depth,2.);

    float fogFactor = 1.-exp(-(depth*0.000006));

    //需要与背景同步
    vec3 noiseFogColorT = texture2D(noiseFogTexture,viewerUV.xy*24.).xyz;

    //混合主颜色
    gl_FragColor.rgb = mix( gl_FragColor.rgb, noiseFogColorT, fogFactor );
#endif
