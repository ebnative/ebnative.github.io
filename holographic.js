/* Native WebGPU adapter for Vercel's MIT vgpu holographic-card material.
 * One shared canvas/device, active only on the selected hover/focus panel.
 * Source and adaptation details: vgpu-LICENSE.txt. */
(() => {
  'use strict';
  const grid = document.querySelector('#selected-grid');
  const fine = matchMedia('(min-width:701px)');
  const reduced = matchMedia('(prefers-reduced-motion:reduce)');
  const canvas = document.createElement('canvas');
  canvas.className = 'holo-canvas';
  canvas.setAttribute('aria-hidden','true');
  let initialization, gpu, active, frame = 0, failed = false;
  let x = .2, y = -.25, targetX = .2, targetY = -.25;
  async function initialize() {
    if (!navigator.gpu) throw Error('WebGPU unavailable');
    const adapter = await navigator.gpu.requestAdapter({powerPreference:'low-power'});
    if (!adapter) throw Error('No WebGPU adapter');
    const device = await adapter.requestDevice();
    try {
      const response = await fetch('holographic.wgsl',{cache:'no-cache'});
      if (!response.ok) throw Error('Shader unavailable');
      const shader = device.createShaderModule({code:await response.text()});
      const info = await shader.getCompilationInfo();
      if (info.messages.some(message => message.type === 'error')) throw Error('Shader compilation failed');
      const format = navigator.gpu.getPreferredCanvasFormat();
      const vertex = device.createShaderModule({code:`
        struct Out { @builtin(position) pos:vec4f, @location(0) uv:vec2f };
        @vertex fn vs(@builtin(vertex_index) n:u32)->Out {
          var points=array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));
          var out:Out;out.pos=vec4f(points[n],0,1);
          out.uv=vec2f((points[n].x+1)*.5,(1-points[n].y)*.5);return out;
        }`});
      const pipeline = await device.createRenderPipelineAsync({layout:'auto',vertex:{module:vertex,entryPoint:'vs'},fragment:{module:shader,entryPoint:'fs_main',targets:[{format}]},primitive:{topology:'triangle-list'}});
      const uniform = device.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
      // Page typography remains HTML. A zero mask suppresses demo lettering.
      const texture = device.createTexture({size:[1,1],format:'r8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
      device.queue.writeTexture({texture},new Uint8Array([0]),{bytesPerRow:1},[1,1]);
      const bindings = device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[
        {binding:0,resource:{buffer:uniform}}, {binding:1,resource:texture.createView()},
        {binding:2,resource:device.createSampler({minFilter:'linear',magFilter:'linear'})}
      ]});
      const context = canvas.getContext('webgpu');
      context.configure({device,format,alphaMode:'opaque'});
      device.lost.then(() => { failed = true; stop(); });
      return {device,context,pipeline,uniform,bindings};
    } catch (error) { device.destroy(); throw error; }
  }
  function stop() {
    cancelAnimationFrame(frame);frame = 0;
    if (active) delete active.dataset.holoReady;
    canvas.remove();active = null;
  }
  function render() {
    frame = 0;
    if (!active?.isConnected || !gpu || document.hidden || failed) return;
    const rect = active.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio,1.5);
    const width = Math.max(1,Math.round(rect.width*dpr));
    const height = Math.max(1,Math.round(rect.height*dpr));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width;canvas.height = height; }
    x += (targetX-x)*.24;y += (targetY-y)*.24;
    gpu.device.queue.writeBuffer(gpu.uniform,0,new Float32Array([width,height,0,0,x,y,1,0]));
    const encoder = gpu.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({colorAttachments:[{view:gpu.context.getCurrentTexture().createView(),loadOp:'clear',storeOp:'store',clearValue:{r:0,g:0,b:0,a:1}}]});
    pass.setPipeline(gpu.pipeline);pass.setBindGroup(0,gpu.bindings);pass.draw(3);pass.end();
    gpu.device.queue.submit([encoder.finish()]);
    canvas.dataset.renderer = 'vgpu-wgsl';
    if (!reduced.matches && Math.abs(targetX-x)+Math.abs(targetY-y)>.001) frame=requestAnimationFrame(render);
  }
  function requestFrame() { if (!frame && gpu && active && !failed) frame=requestAnimationFrame(render); }
  function point(event,panel) {
    if (reduced.matches || !('clientX' in event)) return;
    const r=panel.getBoundingClientRect();
    targetX=Math.max(-1,Math.min(1,(event.clientX-r.left)/r.width*2-1));
    targetY=Math.max(-1,Math.min(1,(event.clientY-r.top)/r.height*2-1));
  }
  async function activate(event) {
    if (!fine.matches || failed) return;
    const tile=event.target.closest('.showcase-tile');
    if (!tile || (!matchMedia('(hover:hover)').matches && !tile.classList.contains('is-preview'))) return;
    const panel=tile.querySelector('.card-overlay');
    if (!panel) return;
    point(event,panel);
    if (active===panel) {requestFrame();return;}
    stop();active=panel;x=targetX;y=targetY;
    try {
      initialization ||= initialize();gpu=await initialization;
      if (active!==panel || !panel.isConnected) return;
      panel.append(canvas);panel.dataset.holoReady='true';requestFrame();
    } catch { failed=true;stop(); /* Retain the quiet CSS fallback. */ }
  }
  grid.addEventListener('showcasepreview',event=>{
    if(!event.detail){stop();return;}
    activate({target:event.detail.tile,clientX:event.detail.clientX,clientY:event.detail.clientY});
  });
  grid.addEventListener('pointerover',activate);
  grid.addEventListener('focusin',activate);
  grid.addEventListener('pointermove',event=>{if(active){point(event,active);requestFrame();}});
  grid.addEventListener('pointerout',event=>{
    const tile=event.target.closest('.showcase-tile');
    if(tile&&!tile.classList.contains('is-preview')&&!tile.contains(event.relatedTarget)&&!tile.contains(document.activeElement))stop();
  });
  grid.addEventListener('focusout',()=>{if(!grid.matches(':hover')&&!grid.querySelector('.is-preview'))stop();});
  new MutationObserver(()=>{if(active&&!active.isConnected)stop();}).observe(grid,{childList:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  fine.addEventListener('change',()=>{if(!fine.matches)stop();});
  reduced.addEventListener('change',()=>{targetX=x=.2;targetY=y=-.25;requestFrame();});
  window.addEventListener('resize',requestFrame);
  window.addEventListener('pagehide',()=>{stop();gpu?.device.destroy();});
})();
