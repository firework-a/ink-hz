export default `float hash2(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

vec3 hash3( vec3 p ) {
	p = vec3( dot(p,vec3(127.1,311.7, 74.7)),
			  dot(p,vec3(269.5,183.3,246.1)),
			  dot(p,vec3(113.5,271.9,124.6)));
	return fract(sin(p)*43758.5453123);
}

float screenHash() {
	return hash2(gl_FragCoord.xy * 0.05);
}
`;
