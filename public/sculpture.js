// A locally rendered parametric sculpture. No external models or textures.
const vertexSource = `
precision highp float;
attribute vec2 a_uv;
uniform float u_time;
uniform float u_progress;
uniform float u_aspect;
uniform vec2 u_pointer;
uniform float u_mobile;
varying vec3 v_normal;
varying vec3 v_position;
varying vec2 v_uv;
const float PI = 3.14159265359;
vec3 center(float u, float morph) {
  vec3 knot = vec3((1.0 + .32*cos(3.0*u))*cos(2.0*u), (1.0 + .32*cos(3.0*u))*sin(2.0*u), .65*sin(3.0*u));
  vec3 ring = vec3(1.18*cos(u), 1.18*sin(u), .13*sin(3.0*u));
  return mix(knot, ring, morph);
}
vec3 surface(vec2 uv, float morph) {
  float u = uv.x*2.0*PI;
  float v = uv.y*2.0*PI;
  vec3 c = center(u,morph);
  vec3 tangent = normalize(center(u+.001,morph)-center(u-.001,morph));
  vec3 side = normalize(cross(tangent,vec3(0.,0.,1.)));
  vec3 up = normalize(cross(side,tangent));
  float tube = mix(.255,.36,morph) * (1.0 + .035*sin(v*6.0 + u*12.0));
  return c + tube*(cos(v)*side+sin(v)*up);
}
mat3 rotateX(float a) {float c=cos(a),s=sin(a);return mat3(1,0,0,0,c,s,0,-s,c);}
mat3 rotateY(float a) {float c=cos(a),s=sin(a);return mat3(c,0,-s,0,1,0,s,0,c);}
mat3 rotateZ(float a) {float c=cos(a),s=sin(a);return mat3(c,s,0,-s,c,0,0,0,1);}
void main() {
  float morph = smoothstep(.1,.95,u_progress)*(1.0-smoothstep(1.3,2.3,u_progress));
  vec3 pos = surface(a_uv,morph);
  vec3 du = surface(a_uv+vec2(.0003,0),morph)-surface(a_uv-vec2(.0003,0),morph);
  vec3 dv = surface(a_uv+vec2(0,.0003),morph)-surface(a_uv-vec2(0,.0003),morph);
  vec3 normal = normalize(cross(du,dv));
  mat3 rotation = rotateZ(-.28+u_progress*.65)*rotateY(u_time*.12+u_pointer.x*.25+u_progress*1.3)*rotateX(.55+u_pointer.y*.2);
  pos = rotation*pos;
  normal = rotation*normal;
  float travel = smoothstep(.1,.9,u_progress)-smoothstep(1.2,1.9,u_progress);
  float finale = smoothstep(2.4,3.,u_progress);
  float scale = mix(1.0,.85,finale);
  pos *= scale;
  v_normal=normal; v_position=pos; v_uv=a_uv;
  float depth=4.8-pos.z;
  vec2 screen=pos.xy*2.45/depth;
  screen.x/=u_aspect;
  float side=mix(.41,-.44,travel)*(1.0-finale);
  screen.x+=mix(side,0.,u_mobile);
  screen.y+=mix(.02,-.25,u_mobile)+finale*.14;
  // Use a proper perspective depth mapping for the interwoven surface.
  gl_Position=vec4(screen*depth,(depth-1.0)*1.02-1.0,depth);
}`;
const fragmentSource = `
precision highp float;
uniform float u_time;
uniform float u_progress;
varying vec3 v_normal;
varying vec3 v_position;
varying vec2 v_uv;
void main() {
  vec3 n=normalize(v_normal);
  if (!gl_FrontFacing) n=-n;
  vec3 view=normalize(vec3(0.,0.,5.)-v_position);
  vec3 key=normalize(vec3(-2.,3.,4.));
  vec3 fill=normalize(vec3(3.,-1.,2.));
  float facing=max(dot(n,view),0.);
  float fresnel=pow(1.-facing,2.5);
  vec3 violet=vec3(.38,.19,.76);
  vec3 silver=vec3(.77,.91,.84);
  vec3 pink=vec3(.96,.55,.69);
  float band=sin(dot(n,normalize(vec3(1.,.4,.3)))*5.0+v_position.y*.7+u_progress*1.8)*.5+.5;
  vec3 base=mix(violet,silver,smoothstep(.15,.8,band));
  base=mix(base,pink,pow(1.-band,3.)*.7);
  float light=max(dot(n,key),0.);
  float spec=pow(max(dot(n,normalize(key+view)),0.),65.);
  float strip=pow(max(dot(n,normalize(fill+view)),0.),18.);
  float rib=.96+.04*sin(v_uv.x*2.*3.14159*100.);
  vec3 color=base*(.18+light*.78)*rib;
  color+=vec3(1.,.96,.88)*spec*1.6;
  color+=vec3(.65,.81,1.)*strip*.65;
  color+=vec3(.67,.49,.96)*fresnel*.6;
  color=pow(color,vec3(.88));
  gl_FragColor=vec4(color,1.);
}`;

export function createSculpture(canvas) {
  const gl = canvas.getContext('webgl', {alpha: true, antialias: true, powerPreference: 'low-power'});
  if (!gl) return createCanvasSculpture(canvas);
  const resources = [];
  function shader(type, source) {
    const value = gl.createShader(type);
    gl.shaderSource(value, source); gl.compileShader(value);
    if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(value); gl.deleteShader(value); throw Error(message);
    }
    resources.push(value); return value;
  }
  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
  } catch (error) {
    console.warn('Sculpture fallback:', error.message);
    resources.forEach(s => gl.deleteShader(s));
    if (program) gl.deleteProgram(program);
    return createCanvasSculpture(canvas);
  }
  const segments = 220, sides = 36, vertices = [];
  for (let u = 0; u < segments; u++) for (let v = 0; v < sides; v++) {
    vertices.push(u/segments,v/sides,(u+1)/segments,v/sides,u/segments,(v+1)/sides,
      (u+1)/segments,v/sides,(u+1)/segments,(v+1)/sides,u/segments,(v+1)/sides);
  }
  const buffer=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
  gl.useProgram(program);
  const attribute=gl.getAttribLocation(program,'a_uv');
  gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,2,gl.FLOAT,false,0,0);
  const uniforms=Object.fromEntries(['time','progress','aspect','pointer','mobile'].map(key=>[key,gl.getUniformLocation(program,'u_'+key)]));
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
  let width=1,height=1,lost=false;
  const loss = event => {event.preventDefault();lost=true;canvas.closest('.experience')?.classList.remove('has-sculpture');};
  canvas.addEventListener('webglcontextlost',loss);
  function resize() {
    width=innerWidth;height=innerHeight;
    const ratio=Math.min(devicePixelRatio||1,width<760?1.25:1.5);
    canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
    gl.viewport(0,0,canvas.width,canvas.height);
  }
  return {
    resize,
    draw(time,progress,x,y) {
      if(lost) return;
      gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.uniform1f(uniforms.time,time);gl.uniform1f(uniforms.progress,progress);
      gl.uniform1f(uniforms.aspect,width/height);gl.uniform2f(uniforms.pointer,x,y);
      gl.uniform1f(uniforms.mobile,width<760?1:0);
      gl.drawArrays(gl.TRIANGLES,0,vertices.length/2);
    },
    dispose() {
      canvas.removeEventListener('webglcontextlost',loss);
      gl.deleteBuffer(buffer);resources.forEach(s=>gl.deleteShader(s));gl.deleteProgram(program);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  };
}

// Software renderer for browsers that disable WebGL. It uses the same knot,
// perspective camera and scroll choreography, with a smaller mesh.
function createCanvasSculpture(original) {
  const canvas = original.cloneNode(false);
  original.replaceWith(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const segments = 128, sides = 36;
  let width = 1, height = 1, ratio = 1, previousMorph = -1, points = [], normals = [];
  const mix = (a,b,t) => a+(b-a)*t;
  const smooth = (a,b,x) => {const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
  const normalize = v => {const length=Math.hypot(...v)||1;return v.map(x=>x/length);};
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const key=normalize([-2,3,4]), highlight=normalize([-2,3,9]), fill=normalize([3,-1,7]);
  function center(u,m) {
    return [mix((1+.32*Math.cos(3*u))*Math.cos(2*u),1.18*Math.cos(u),m),
      mix((1+.32*Math.cos(3*u))*Math.sin(2*u),1.18*Math.sin(u),m),
      mix(.65*Math.sin(3*u),.13*Math.sin(3*u),m)];
  }
  function mesh(morph) {
    points=[];normals=[];
    for(let i=0;i<=segments;i++) {
      const u=i/segments*Math.PI*2, c=center(u,morph);
      const next=center(u+.001,morph), prev=center(u-.001,morph);
      const tangent=normalize(next.map((x,j)=>x-prev[j]));
      const side=normalize(cross(tangent,[0,0,1])), up=normalize(cross(side,tangent));
      for(let j=0;j<=sides;j++) {
        const v=j/sides*Math.PI*2;
        const normal=side.map((x,k)=>Math.cos(v)*x+Math.sin(v)*up[k]);
        const tube=mix(.255,.36,morph);
        normals.push(normal);points.push(c.map((x,k)=>x+tube*normal[k]));
      }
    }
  }
  function rotate(v, angles) {
    const [cx,sx,cy,sy,cz,sz]=angles;
    const y=v[1]*cx-v[2]*sx,z=v[1]*sx+v[2]*cx;
    const x=v[0]*cy+z*sy,rz=-v[0]*sy+z*cy;
    return [x*cz-y*sz,x*sz+y*cz,rz];
  }
  function resize() {
    width=innerWidth;height=innerHeight;ratio=Math.min(devicePixelRatio||1,1.5);
    canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
    ctx.setTransform(ratio,0,0,ratio,0,0);
  }
  return {resize,dispose(){},draw(time,progress,px,py) {
    const morph=smooth(.1,.95,progress)*(1-smooth(1.3,2.3,progress));
    if(Math.abs(morph-previousMorph)>.002) {mesh(morph);previousMorph=morph;}
    const ax=.55+py*.2,ay=time*.12+px*.25+progress*1.3,az=-.28+progress*.65;
    const angles=[Math.cos(ax),Math.sin(ax),Math.cos(ay),Math.sin(ay),Math.cos(az),Math.sin(az)];
    const travel=smooth(.1,.9,progress)-smooth(1.2,1.9,progress),finale=smooth(2.4,3,progress);
    const mobile=width<760,scale=mix(1,.85,finale);
    const offsetX=mobile?0:mix(.41,-.44,travel)*(1-finale),offsetY=(mobile?-.25:.02)+finale*.14;
    const projected=points.map(point=>{
      const p=rotate(point,angles).map(x=>x*scale),depth=4.8-p[2];
      return [width*(.5+offsetX*.5)+p[0]*2.45/depth*height*.5,height*(.5-offsetY*.5)-p[1]*2.45/depth*height*.5,p[2]];
    });
    const faces=[];
    for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){
      const a=i*(sides+1)+j,b=a+sides+1;
      faces.push({indices:[a,b,b+1,a+1],depth:(projected[a][2]+projected[b+1][2])*.5});
    }
    faces.sort((a,b)=>a.depth-b.depth);
    ctx.clearRect(0,0,width,height);
    for(const face of faces) {
      const n=normalize(rotate(face.indices.reduce((sum,index)=>sum.map((v,k)=>v+normals[index][k]),[0,0,0]),angles));
      const band=Math.sin(dot(n,[.88,.35,.26])*5+progress*1.8)*.5+.5;
      const blend=smooth(.15,.8,band),pink=Math.pow(1-band,3)*.7;
      const base=[mix(.38,.77,blend),mix(.19,.91,blend),mix(.76,.84,blend)].map((c,k)=>mix(c,[.96,.55,.69][k],pink));
      const light=Math.max(dot(n,key),0), spec=Math.pow(Math.max(dot(n,highlight),0),65)*1.6;
      const strip=Math.pow(Math.max(dot(n,fill),0),18)*.65,fresnel=Math.pow(1-Math.max(n[2],0),2.5)*.6;
      const rgb=base.map((c,k)=>Math.round(Math.min(1,Math.pow(c*(.18+light*.78)+[1,.96,.88][k]*spec+[.65,.81,1][k]*strip+[.67,.49,.96][k]*fresnel,.88))*255));
      ctx.fillStyle=`rgb(${rgb.join(',')})`;ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=.6;
      ctx.beginPath();face.indices.forEach((index,k)=>{const p=projected[index];if(k)ctx.lineTo(p[0],p[1]);else ctx.moveTo(p[0],p[1]);});
      ctx.closePath();ctx.fill();ctx.stroke();
    }
  }};
}
