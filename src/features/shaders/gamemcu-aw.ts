export default `const vec4 edgeParams = vec4(-1622.3, -1086.4, 1810.6, 1480.4);
const vec4 edgeTexCoord = vec4(-edgeParams.xy / (edgeParams.zw - edgeParams.xy), 1. / (edgeParams.zw - edgeParams.xy));
uniform sampler2D waterEdge;

vec4 textureEdge(in vec2 worldPos) {
    return texture2D(waterEdge, worldPos * edgeTexCoord.zw + edgeTexCoord.xy);
}
`;
