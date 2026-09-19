const waterFrag = `
                    uniform sampler2D mirrorSampler;
                    uniform float alpha;
                    uniform float time;
                    uniform float size;
                    uniform float distortionScale;
                    uniform sampler2D normalSampler;
                    uniform vec3 sunColor;
                    uniform vec3 sunDirection;
                    uniform vec3 eye;
                    uniform vec3 waterColor;
    
                    uniform vec3 targetPos;
    
                    \${Ha}
                    \${Rl}
                    \${f8}
    
                    varying vec4 mirrorCoord;
                    varying vec4 worldPosition;
                    varying vec3 vPositionW;
    
                    uniform sampler2D waterColorMask;
    
                    vec4 getNoise( vec2 uv ) {
                        vec2 uv0 = ( uv / 103.0 ) + vec2(time / 17.0, time / 29.0);
                        vec2 uv1 = uv / 107.0-vec2( time / -19.0, time / 31.0 );
                        vec2 uv2 = uv / vec2( 8907.0, 9803.0 ) + vec2( time / 101.0, time / 97.0 );
                        vec2 uv3 = uv / vec2( 1091.0, 1027.0 ) - vec2( time / 109.0, time / -113.0 );
                        vec4 noise = texture2D( normalSampler, uv0 ) +
                            texture2D( normalSampler, uv1 ) +
                            texture2D( normalSampler, uv2 ) +
                            texture2D( normalSampler, uv3 );
                        return noise * 0.5 - 1.0;
                    }
    
                    void gaussianBlur( const sampler2D blurTexture, const vec2 uv, inout vec3 Color){
                        float Pi = 6.28318530718; // Pi*2
        
                        // GAUSSIAN BLUR SETTINGS {{{
                        float Directions = 16.0; // BLUR DIRECTIONS (Default 16.0 - More is better but slower)
                        float Quality = 3.0; // BLUR QUALITY (Default 4.0 - More is better but slower)
                        float Size = 3.0; // BLUR SIZE (Radius)
                        // GAUSSIAN BLUR SETTINGS }}}
                    
                        vec2 Radius = Size/vec2(512,512);
                        
                        // Pixel colour
                        Color = texture2D(blurTexture, uv).xyz;
                        
                        // Blur calculations
                        for( float d=0.0; d<Pi; d+=Pi/Directions)
                        {
                            for(float i=1.0/Quality; i<=1.0; i+=1.0/Quality)
                            {
                                Color += texture2D( blurTexture, uv+vec2(cos(d),sin(d))*Radius*i).xyz;		
                            }
                        }
                        
                        // Output to screen
                        Color /= Quality * Directions - 15.0;
                    }
    
                    #include <common>
                    #include <packing>
                    #include <bsdfs>
                    #include <logdepthbuf_pars_fragment>
                    #include <lights_pars_begin>
                    #include <shadowmap_pars_fragment>
                    #include <shadowmask_pars_fragment>
    
                    void main() {
    
                        #include <logdepthbuf_fragment>
                        vec4 noise = getNoise( worldPosition.xz * size );
                        vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );
    
                        vec3 diffuseLight = vec3(0.0);
                        vec3 specularLight = vec3(0.0);
    
                        vec3 worldToEye = eye-worldPosition.xyz;
                        vec3 eyeDirection = normalize( worldToEye );
    
                        float distance = length(worldToEye);
    
                        vec2 distortion = surfaceNormal.xz * ( 0.001 + 1.0 / distance ) * distortionScale;
                        vec3 reflectionSample = vec3( texture2D( mirrorSampler, mirrorCoord.xy / mirrorCoord.w + distortion ) );
    
                        // vec3 reflectionSample = vec3(0.);
                        // gaussianBlur(mirrorSampler, mirrorCoord.xy / mirrorCoord.w + distortion,reflectionSample);
    
                        float theta = max( dot( eyeDirection, surfaceNormal ), 0.0 );
                        theta = pow(theta,0.5);
                        float rf0 = 0.3;
                        float reflectance = rf0 + ( 1.0 - rf0 ) * pow( ( 1.0 - theta ), 5.0 );
                        vec3 waterColorMix = mix(vec3(0x4b,0x5b,0x5d)/255.,waterColor,texture2D(waterColorMask,worldPosition.xz*0.05+vec2(time*0.2)).x);
                        vec3 scatter = max( 0.0, dot( surfaceNormal, eyeDirection ) ) * waterColorMix;
                        vec3 albedo = mix( ( sunColor * diffuseLight * 0.3 + scatter ) * getShadowMask(), ( vec3( 0.1 ) + reflectionSample * 0.9 + reflectionSample * specularLight ), reflectance);
                        gl_FragColor = vec4( albedo, 1. );
                        #include <tonemapping_fragment>
                        \${Pl}
                    }`;
export default waterFrag;
