
(() => {
    let canvas = null;
    let worker = null;

    window.addEventListener('load', () => {
        if(window.Worker != null){
            worker = new Worker('./script/worker.js');
            window.addEventListener('mousemove', (eve) => {
                worker.postMessage({
                    type: 'mousemove',
                    x: eve.clientX / window.innerWidth,
                    y: eve.clientY / window.innerHeight
                });
            }, false);
            window.addEventListener('keydown', (eve) => {
                worker.postMessage({type: 'keydown', key: eve.key});
            }, false);
            window.addEventListener('resize', (eve) => {
                worker.postMessage({
                    type: 'resize',
                    width: window.innerWidth,
                    height: window.innerHeight
                });
            }, false);
        }else{
            console.log('ERR: webworker not supported');
            return;
        }

        canvas = document.body.querySelector('#canvas');
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
        let offscreenCanvas = canvas.transferControlToOffscreen();
        worker.postMessage({
            type: 'init',
            offscreen: offscreenCanvas,
            source: FRAGMENT_SHADER_SOURCE
        }, [offscreenCanvas]);
    }, false);

    const FRAGMENT_SHADER_SOURCE = `
#ifdef GL_ES
precision lowp float;
#endif
// ***********************************************************
// Alcatraz / Rhodium 4k Intro Glibberball
// by Jochen "Virgill" Feldkötter
//
// 4kb executable: http://www.pouet.net/prod.php?which=68239
// Youtube: https://www.youtube.com/watch?v=YK7fbtQw3ZU
// ***********************************************************
// PORTED to GLSL Heroku by JaK^threepixels

uniform float time;
uniform vec2 mouse;
uniform vec2 resolution;
uniform sampler2D optTex;
uniform sampler2D backbuffer;

float lowFreq;
float midFreq;
float highFreq;


float CorrectTime=((time-30000.)*.002);

//ShaderTOY
vec3   iResolution = vec3(resolution, 1.0);
float  iGlobalTime = time;
vec4   iMouse = vec4(mouse, 0.0, 1.0);
uniform sampler2D iChannel0,iChannel1;


#define iTime time
#define iResolution ressolution

// ***********************************************************
// Alcatraz / Rhodium 4k Intro Glibberball
// by Jochen "Virgill" Feldkötter
//
// 4kb executable: http://www.pouet.net/prod.php?which=68239
// Youtube: https://www.youtube.com/watch?v=YK7fbtQw3ZU
// ***********************************************************



//     triangle function


float bounce;

//     signed box
float sdBox(vec3 p,vec3 b)
{
  vec3 d=abs(p)-b;
  return min(max(d.x,max(d.y,d.z)),0.)+length(max(d,0.));
}

//     rotation
void pR(inout vec2 p,float a)
{
    p=cos(a)*p+sin(a)*vec2(p.y,-p.x);
}

//     3D noise function (IQ)
float noise(vec3 p)
{
    vec3 ip=floor(p);
    p-=ip;
    vec3 s=vec3(7,157,113);
    vec4 h=vec4(0.,s.yz,s.y+s.z)+dot(ip,s);
    p=p*p*(3.-2.*p);
    h=mix(fract(sin(h)*43758.5),fract(sin(h+s.x)*43758.5),p.x);
    h.xy=mix(h.xz,h.yw,p.y);
    return mix(h.x,h.y,p.z);
}

float map(vec3 p)
{
    pR(p.yx,bounce*.4);
    pR(p.zx,iTime*.3);
    return min(max(sdBox(p,vec3(2.5, 2.5, 0))-.3,-sdBox(p,vec3(1.2, 1.2, 1))+.5)-0.003*noise(55.*p),length(p)-1.6+0.3*noise(3.5*p-.5*iTime));
}

//    normal calculation
vec3 calcNormal(vec3 pos)
{
    float eps=0.0001;
    float d=map(pos);
    return normalize(vec3(map(pos+vec3(eps,0,0))-d,map(pos+vec3(0,eps,0))-d,map(pos+vec3(0,0,eps))-d));
}


//     standard sphere tracing inside and outside
float castRayx(vec3 ro,vec3 rd)
{
    float function_sign=(map(ro)<0.)?-1.:1.;
    float precis=.0001;
    float h=precis*2.;
    float t=0.;
    for(int i=0;i<120;i++)
    {
        if(abs(h)<precis||t>12.)break;
        h=function_sign*map(ro+rd*t);
        t+=h;
    }
    return t;
}

//     refraction
float refr(vec3 pos,vec3 lig,vec3 dir,vec3 nor,float angle,out float t2, out vec3 nor2)
{
    float h=0.;
    t2=2.;
    vec3 dir2=refract(dir,nor,angle);
     for(int i=0;i<50;i++)
    {
        if(abs(h)>3.) break;
        h=map(pos+dir2*t2);
        t2-=h;
    }
    nor2=calcNormal(pos+dir2*t2);
    return(.5*clamp(dot(-lig,nor2),0.,1.)+pow(max(dot(reflect(dir2,nor2),lig),0.),8.));
}

//    softshadow
float softshadow(vec3 ro,vec3 rd)
{
    float sh=1.;
    float t=.02;
    float h=.0;
    for(int i=0;i<22;i++)
    {
        if(t>20.)continue;
        h=map(ro+rd*t);
        sh=min(sh,4.*h/t);
        t+=h;
    }
    return sh;
}

//    main function
vec4 mainScene(vec2 fragCoord)
{
    bounce=abs(fract(0.05*iTime)-.5)*20.;
    vec2 uv=gl_FragCoord.xy/resolution.xy;
    vec2 p=uv*2.-1.;

//     bouncy cam every 10 seconds
    float wobble=(fract(.1*(iTime-1.))>=0.9)?fract(-iTime)*0.1*sin(30.*iTime):0.;

//  camera
    vec3 dir = normalize(vec3(2.*gl_FragCoord.xy -resolution.xy, resolution.y));
//    org (Left-Right,Down-Up,Near-Far)
    vec3 org = vec3(0,2.*wobble,-3.);

//     standard sphere tracing:
    vec3 color = vec3(0.);
    vec3 color2= vec3(0.);
    float t=castRayx(org,dir);
    vec3 pos=org+dir*t;
    vec3 nor=calcNormal(pos);

//     lighting:
    vec3 lig=normalize(vec3(.2,6.,.5));

//    scene depth
    float depth=clamp((1.-0.09*t),0.,1.);

    vec3 pos2,nor2 =  vec3(0.);
    if(t<12.0)
    {
        color2 = vec3(max(dot(lig,nor),0.)  +  pow(max(dot(reflect(dir,nor),lig),0.),16.));
        color2 *=clamp(softshadow(pos,lig),0.,1.);  // shadow
           float t2;
        color2.r +=refr(pos,lig,dir,nor,0.92, t2, nor2)*depth;
        color2.g +=refr(pos,lig,dir,nor,0.90, t2, nor2)*depth;
        color2.b +=refr(pos,lig,dir,nor,0.88, t2, nor2)*depth;
          color2-=clamp(.1*t2,0.,1.);                // inner intensity loss
    }


    float tmp = 0.;
    float T = 1.;

//    animation of glow intensity
    float intensity = 0.1*-sin(.209*iTime+1.)+0.05;
    for(int i=0; i<128; i++)
    {
        float density = 0.; float nebula = noise(org+bounce);
        density=intensity-map(org+.5*nor2)*nebula;
        if(density>0.)
        {
            tmp = density / 128.;
            T *= 1. -tmp * 100.;
            if( T <= 0.) break;
        }
        org += dir*0.078;
    }
    vec3 basecol=vec3(1./16.,.25,1.);
    T=clamp(T,0.,1.5);
    color += basecol* exp(4.*(0.5-T) - 0.8);
    color2*=depth;
    color2+= (1.-depth)*noise(6.*dir+0.3*iTime)*.1;

//    scene depth included in alpha channel
    vec4 finalRGB = vec4(vec3(1.*color+0.8*color2)*1.3,abs(0.67-depth)*2.+4.*wobble);
    return finalRGB;
}



float GA =2.399;


//     simplyfied version of Dave Hoskins blur
vec3 dof(sampler2D tex,vec2 uv,float rad)
{
    vec3 acc=vec3(0);
    vec2 pixel=vec2(.002*resolution.y/resolution.x,.002),angle=vec2(0,rad);;
    rad=1.;
    for (int j=0;j<80;j++)
    {
        rad += 1./rad;
        angle*= mat2(cos(GA),sin(GA),-sin(GA),cos(GA));
        vec4 col=texture2D(tex,uv+pixel*(rad-1.)*angle);
        acc+=col.xyz;
    }
    return acc/80.;
}

//-------------------------------------------------------------------------------------------
void main() {

    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 mainPixels=mainScene(uv);
    mainPixels.w=1.0;
    //can't write toa adiotional teture here, so no DOF postFX
    //texture2D(backbuffer,uv)=mainPixels;
    //gl_FragColor=vec4(dof(backbuffer,uv,texture2D(backbuffer,uv).w),1.);

    gl_FragColor=mainPixels;
    //vec4(dof(mainRender,uv,mainPixels.w),1.);
}
`;

})();

