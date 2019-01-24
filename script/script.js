
(() => {
    const CANVAS_SIZE = 512;
    let canvas = null;
    let worker = null;

    window.addEventListener('load', () => {
        if(window.Worker != null){
            worker = new Worker('./script/worker.js');
            window.addEventListener('keydown', (eve) => {
                worker.postMessage({type: 'keydown', key: eve.key});
            }, false);
            window.addEventListener('resize', (eve) => {
            }, false);
        }else{
            console.log('ERR: webworker not supported');
            return;
        }

        canvas = document.querySelector('#canvas');
        canvas.width  = CANVAS_SIZE;
        canvas.height = CANVAS_SIZE;
        let offscreenCanvas = canvas.transferControlToOffscreen();
        worker.postMessage({
            type: 'init',
            offscreen: offscreenCanvas,
            source: FRAGMENT_SHADER_SOURCE
        }, [offscreenCanvas]);
    }, false);

    const FRAGMENT_SHADER_SOURCE = `
precision mediump float;
uniform vec2  resolution;
uniform vec2  mouse;
uniform float time;
uniform sampler2D backbuffer;
const vec3 pinkColor = vec3(1.0, 0.1, 0.5);
const vec3 blueColor = vec3(0.1, 0.3, 0.9);
float neon(vec2 p, float power, float width, float height, float speed){
    float x = cos(abs(p.x * width));
    float y = power / abs(p.y + sin(p.x * 25.0 + time * speed) * height);
    return max(x * y, 0.0);
}
void main(){
    vec2 p = (gl_FragCoord.xy * 2.0 - resolution) / min(resolution.x, resolution.y);
    vec2 m = mouse * 2.0 - 1.0;
    float t = min(time, 2.0) * 0.5;
    p = p * abs(atan(p.y / p.x));
    float a = neon(p, 0.2, 5.0, 0.25 + abs(m.x), 0.75);
    float b = neon(p, 0.5, 2.5, 0.5  + abs(m.y), 0.25);
    gl_FragColor = vec4((pinkColor * a + blueColor * b) * t, 1.0);
}`;

})();

