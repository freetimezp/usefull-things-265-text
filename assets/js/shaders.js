export const frag = `
  precision highp float;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec2 uMouse;

  // 2D Random
  float random(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);} 

  // 2D Noise
  float noise(vec2 p){
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = random(i);
    float b = random(i+vec2(1.0,0.0));
    float c = random(i+vec2(0.0,1.0));
    float d = random(i+vec2(1.0,1.0));
    vec2 u = f*f*(3.0-2.0*f);
    return mix(a,b,u.x)+ (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
  }

  void main(){
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    vec2 p = uv * vec2(uResolution.x/uResolution.y, 1.0);
    float t = uTime * 0.35;

    // move mouse influence into shader space (-1..1)
    vec2 m = (uMouse / uResolution) * 2.0 - 1.0;
    m.y *= -1.0;

    // base noise
    float n = 0.0;
    n += 0.5000*noise(p * 1.0 + t);
    n += 0.2500*noise(p * 2.3 + t*1.2);
    n += 0.1250*noise(p * 4.6 + t*2.0);
    n *= 1.0;

    // create ripple centered on mouse
    float d = distance(uv, uMouse / uResolution);
    float ripple = 0.02 * sin((d*40.0 - t*6.0)) / (d*6.0 + 0.2);

    // distortion strength modulated by noise + ripple
    float strength = n * 0.15 + ripple;

    vec2 displaced = uv + vec2(strength * (m.x*0.5 + 0.2), strength * (m.y*0.5));

    // build iridescent color wave
    vec3 col = vec3(0.02, 0.03, 0.06);
    col += 0.6 * vec3(0.2 + 0.6*noise(displaced*3.0 + t), 0.5 + 0.4*noise(displaced*4.0 - t*1.2), 0.6 + 0.4*noise(displaced*2.0 + t*0.5));

    // glass-like rim highlight based on view angle (fake) and local noise
    float rim = smoothstep(0.4, 0.0, length(displaced - 0.5))*0.7;
    col += vec3(0.9,0.95,1.0)*rim*0.18;

    // vignette
    float v = smoothstep(0.0, 0.8, length(uv - 0.5));
    col *= 1.0 - v*0.35;

    gl_FragColor = vec4(col, 1.0);
  }
  `;

export const vert = `
  precision highp float;
  attribute vec3 position;
  attribute vec2 uv;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  varying vec2 vUv;
  void main(){
    vUv = uv;
    vec4 pos = vec4(position,1.0);
    gl_Position = projectionMatrix * modelViewMatrix * pos;
  }
  `;
