export default `
    uniform vec3 noiseFogColor;
    uniform sampler2D noiseFogTexture;
    uniform float fogNear;
    uniform float fogFar;
    uniform float fogIntensity;
    varying vec4 viewerUV;
`;
