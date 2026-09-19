export default `
float fresnel(float vPow){
    vec3 viewDirectionW = normalize(cameraPosition - vPositionW);
	float fresnelTerm = dot(viewDirectionW, vNormalW);
	fresnelTerm = clamp(1.0 - fresnelTerm, 0., 1.);
    return pow(fresnelTerm,vPow);
}`;
