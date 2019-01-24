
let canvas, frag;

onmessage = (e) => {
    if(e == null || e.data == null || e.data.hasOwnProperty('type') !== true){
        return;
    }
    switch(e.data.type){
        case 'keydown':
            if(frag != null){
                frag.run = e.data.key !== 'Escape';
            }
            break;
        case 'resize':
            if(frag != null){
                frag.rect(e.data.width, e.data.height);
            }
            break;
        case 'init':
            canvas = e.data.offscreen;
            frag = new FragmenEX(canvas).render(e.data.source);
            break;
        default:
            break;
    }
};

class FragmenEX {
    /**
     * constructor of fragmen.js
     * @param {OffscreenCanvas} canvas - insert canvas to
     */
    constructor(canvas){
        this.canvas = canvas;
        this.gl = null;
        this.source = '';
        this.width = 0;
        this.height = 0;
        this.run = false;
        this.startTime = 0;
        this.nowTime = 0;
        this.program = null;
        this.uniLocation = null;
        this.attLocation = null;
        this.VS = '';
        this.FS = '';
        this.postProgram = null;
        this.postUniLocation = null;
        this.postAttLocation = null;
        this.postVS = '';
        this.postFS = '';
        this.fFront = null;
        this.fBack = null;
        this.fTemp = null;
        // bind method
        this.render = this.render.bind(this);
        this.rect = this.rect.bind(this);
        this.reset = this.reset.bind(this);
        this.draw = this.draw.bind(this);
        // initial call
        this.init();
    }

    /**
     * initialize fragmen.js
     * @param {object} option - options
     */
    init(){
        // init webgl context
        this.gl = this.canvas.getContext('webgl');
        if(this.gl == null){
            console.log('webgl unsupported');
            return;
        }
        this.gl.getExtension('OES_standard_derivatives');
        // render initial
        this.VS = 'attribute vec3 p;void main(){gl_Position=vec4(p,1.);}';
        this.postVS = `
attribute vec3 position;
varying   vec2 vTexCoord;
void main(){
    vTexCoord   = (position + 1.0).xy / 2.0;
    gl_Position = vec4(position, 1.0);
}`;
        this.postFS = `
precision mediump float;
uniform sampler2D texture;
varying vec2      vTexCoord;
void main(){
    gl_FragColor = texture2D(texture, vTexCoord);
}`;
        this.postProgram = this.gl.createProgram();
        this.createShader(this.postProgram, 0, this.postVS);
        this.createShader(this.postProgram, 1, this.postFS);
        this.gl.linkProgram(this.postProgram);
        this.postUniLocation = {};
        this.postUniLocation.texture = this.gl.getUniformLocation(this.postProgram, 'texture');
        this.postAttLocation = this.gl.getAttribLocation(this.postProgram, 'position');
        this.fFront = this.fBack = this.fTemp = null;
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.gl.createBuffer());
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([-1,1,0,-1,-1,0,1,1,0,1,-1,0]), this.gl.STATIC_DRAW);
        this.gl.disable(this.gl.DEPTH_TEST);
        this.gl.disable(this.gl.CULL_FACE);
        this.gl.disable(this.gl.BLEND);
        this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
    }

    /**
     * rendering hub
     * @param {string} source - fragment shader source
     * @return {object} instance
     */
    render(source){
        if(source == null || source === ''){
            if(this.FS === ''){return;}
        }else{
            this.FS = source;
        }
        if(this.run === true){
            this.run = false;
            setTimeout(this.reset, 500);
        }else{
            this.reset();
        }
        return this;
    }

    /**
     * set rect
     */
    rect(width, height){
        this.width = width;
        this.height = height;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.resetBuffer(this.fFront);
        this.resetBuffer(this.fBack);
        this.resetBuffer(this.fTemp);
        this.fFront = this.createFramebuffer(this.width, this.height);
        this.fBack = this.createFramebuffer(this.width, this.height);
        this.gl.viewport(0, 0, this.width, this.height);
    }

    /**
     * reset renderer
     */
    reset(){
        this.rect(this.canvas.width, this.canvas.height);
        this.program = this.gl.createProgram();
        if(!this.createShader(this.program, 0, this.VS) || !this.createShader(this.program, 1, this.FS)){return;}
        this.gl.linkProgram(this.program);
        if(!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)){
            console.warn(this.gl.getProgramInfoLog(this.program));
            return;
        }
        this.gl.useProgram(this.program);
        this.uniLocation = {};
        this.uniLocation.resolution = this.gl.getUniformLocation(this.program, 'resolution');
        this.uniLocation.mouse = this.gl.getUniformLocation(this.program, 'mouse');
        this.uniLocation.time = this.gl.getUniformLocation(this.program, 'time');
        this.uniLocation.sampler = this.gl.getUniformLocation(this.program, 'backbuffer');
        this.attLocation = this.gl.getAttribLocation(this.program, 'p');
        this.run = true;
        this.startTime = Date.now();
        this.draw();
    }

    /**
     * rendering
     */
    draw(){
        if(this.run !== true){return;}
        requestAnimationFrame(this.draw);
        this.nowTime = (Date.now() - this.startTime) * 0.001;
        this.gl.useProgram(this.program);
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fFront.f);
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.fBack.t);
        this.gl.enableVertexAttribArray(this.attLocation);
        this.gl.vertexAttribPointer(this.attLocation, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        // this.gl.uniform2fv(this.uniLocation.mouse, this.mousePosition);
        this.gl.uniform1f(this.uniLocation.time, this.nowTime);
        this.gl.uniform2fv(this.uniLocation.resolution, [this.width, this.height]);
        this.gl.uniform1i(this.uniLocation.sampler, 0);
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

        this.gl.useProgram(this.postProgram);
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        this.gl.activeTexture(this.gl.TEXTURE1);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.fFront.t);
        this.gl.enableVertexAttribArray(this.postAttLocation);
        this.gl.vertexAttribPointer(this.postAttLocation, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        this.gl.uniform1i(this.postUniLocation.texture, 1);
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

        this.gl.flush();
        this.fTemp = this.fFront;
        this.fFront = this.fBack;
        this.fBack = this.fTemp;
    }

    /**
     * create and compile shader
     * @param {WebGLProgram} p - target program object
     * @param {number} i - 0 or 1, 0 is vertex shader compile mode
     * @param {string} j - shader source
     * @return {boolean} succeeded or not
     */
    createShader(p, i, j){
        if(!this.gl){return;}
        const k = this.gl.createShader(this.gl.VERTEX_SHADER - i);
        this.gl.shaderSource(k, j);
        this.gl.compileShader(k);
        if(!this.gl.getShaderParameter(k, this.gl.COMPILE_STATUS)){
            console.warn(this.gl.getShaderInfoLog(k));
            return false;
        }
        this.gl.attachShader(p, k);
        const l = this.gl.getShaderInfoLog(k);
        if(l !== ''){console.info('shader info: ' + l);}
        return true;
    }

    /**
     * create framebuffer
     * @param {number} width - set to framebuffer width
     * @param {number} height - set to framebuffer height
     * @return {object} custom object
     * <ul>
     *   <li> f {WebGLFramebuffer}
     *   <li> d {WebGLRenderbuffer}
     *   <li> t {WebGLTexture}
     * </ul>
     */
    createFramebuffer(width, height){
        const frameBuffer = this.gl.createFramebuffer();
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, frameBuffer);
        const depthRenderBuffer = this.gl.createRenderbuffer();
        this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, depthRenderBuffer);
        this.gl.renderbufferStorage(this.gl.RENDERBUFFER, this.gl.DEPTH_COMPONENT16, width, height);
        this.gl.framebufferRenderbuffer(this.gl.FRAMEBUFFER, this.gl.DEPTH_ATTACHMENT, this.gl.RENDERBUFFER, depthRenderBuffer);
        const fTexture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, fTexture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, width, height, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, null);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, fTexture, 0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, null);
        this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, null);
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        return {f: frameBuffer, d: depthRenderBuffer, t: fTexture};
    }

    /**
     * framebuffer reset
     * @param {object} obj - custom object(this.createFramebuffer return value)
     */
    resetBuffer(obj){
        if(!this.gl || !obj){return;}
        if(obj.hasOwnProperty('f') && obj.f != null && this.gl.isFramebuffer(obj.f)){
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
            this.gl.deleteFramebuffer(obj.f);
            obj.f = null;
        }
        if(obj.hasOwnProperty('d') && obj.d != null && this.gl.isRenderbuffer(obj.d)){
            this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, null);
            this.gl.deleteRenderbuffer(obj.d);
            obj.d = null;
        }
        if(obj.hasOwnProperty('t') && obj.t != null && this.gl.isTexture(obj.t)){
            this.gl.bindTexture(this.gl.TEXTURE_2D, null);
            this.gl.deleteTexture(obj.t);
            obj.t = null;
        }
        obj = null;
    }
}
