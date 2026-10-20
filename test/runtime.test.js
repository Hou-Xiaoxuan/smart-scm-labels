'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {createPlanner}=require('../lib/layout'),{installRuntime}=require('../lib/runtime');
test('renderer lifecycle: live toggle, tree mode, resize, resource changes, cleanup',()=>{
 class Element {
  constructor(){this.attrs={};this.children=[];this.clientWidth=240;this.style={setProperty(k,v){this[k]=v;},removeProperty(k){delete this[k];}};const set=new Set();this.classList={add:x=>set.add(x),remove:x=>set.delete(x),contains:x=>set.has(x)};}
  append(e){this.children.push(e);e.parent=this;}
  insertBefore(e){this.append(e);}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}
  setAttribute(k,v){this.attrs[k]=v;}
  getAttribute(k){return this.attrs[k]??null;}
  removeAttribute(k){delete this.attrs[k];}
  querySelector(s){if(s==='.smart-scm-label')return this.children.find(c=>c.className==='smart-scm-label');return null;}
 }
 const head=new Element(), callbacks=[], cfg={enabled:false,minPrefixLength:12}, handlers={}; let resize;
 const sandbox={console, document:{head,createElement: tag => tag==='canvas'?{getContext:()=>({measureText:s=>({width:s.length*7})})}:new Element()},
  ResizeObserver:class{constructor(fn){resize=fn;}observe(){}disconnect(){handlers.disconnected=true;}},
  requestAnimationFrame:fn=>(callbacks.push(fn),callbacks.length),cancelAnimationFrame(){},getComputedStyle:()=>({font:'13px sans-serif'})};
 vm.runInNewContext(`(${installRuntime.toString()})(${createPlanner.toString()});`,sandbox);
 const api=sandbox.__smartScm,group={resources:[]};
 group.resources=['CpActivityRecommendationService.java','CpActivityRecommendationServiceImpl.java'].map(name=>({sourceUri:{scheme:'file',path:'/a/'+name,fsPath:'/a/'+name},resourceGroup:group}));
 const heights=new Map(), disposals=[];let rerenders=0;
 const view={viewMode:'list',treeContainer:new Element(),configurationService:{getValue:k=>cfg[k.split('.').at(-1)],onDidChangeConfiguration:fn=>(handlers.config=fn,{dispose(){}})},
  scmViewService:{repositories:[{provider:{groups:[group]}}]},tree:{hasNode:()=>true,updateElementHeight:(r,h)=>heights.set(r,h),rerender(){rerenders++;}},
  updateChildren(){handlers.updated=true;},onDidChangeViewMode:fn=>(handlers.mode=fn,{dispose(){}}),disposables:{add:d=>disposals.push(d)}};
 const flush=()=>{while(callbacks.length)callbacks.shift()();};
 api.attach(view);flush();assert.equal(api.height(group.resources[0]),22);
 cfg.enabled=true;handlers.config({affectsConfiguration:()=>true});flush();assert.equal(heights.get(group.resources[0]),44);
 const host=new Element(),template={fileLabel:{element:host}},data={iconResource:group.resources[0],fileLabelOptions:{hidePath:false},uri:group.resources[0].sourceUri};
 api.render(template,data);assert.equal(host.children[0].children.length,2);assert.ok(host.classList.contains('smart-scm-active'));assert.equal(host.getAttribute('title'),data.uri.fsPath);assert.equal(host.children[0].title,data.uri.fsPath);assert.equal(host.style['--smart-scm-icon-offset'],'22px');
 cfg.maxDisplayLines=1;handlers.config({affectsConfiguration:()=>true});flush();assert.equal(host.children[0].children.length,1);assert.equal(api.height(group.resources[0]),22);assert.equal(host.style['--smart-scm-icon-offset'],'0px');
 cfg.maxDisplayLines=2;handlers.config({affectsConfiguration:()=>true});flush();assert.equal(host.children[0].children.length,2);
 view.treeContainer.clientWidth=1000;resize();flush();assert.equal(host.children.length,0);
 view.treeContainer.clientWidth=240;resize();flush();view.viewMode='tree';handlers.mode();flush();assert.equal(api.height(group.resources[0]),22);
 view.viewMode='list';cfg.enabled=false;handlers.config({affectsConfiguration:()=>true});flush();api.render(template,data);assert.equal(host.children.length,0);assert.equal(host.getAttribute('title'),null);assert.equal(host.style['--smart-scm-icon-offset'],undefined);
 cfg.enabled=true;group.resources.pop();api.changed();flush();assert.equal(api.height(group.resources[0]),22);assert.ok(rerenders>0);

 // Folder-scoped rules are resolved with the original URI and refresh live.
 view.scmViewService.repositories[0].provider.rootUri={scheme:'file',path:'/a'};
 group.resources[0].sourceUri.path='/a/module/src/File.java';
 let resolvedResource;
 view.configurationService.getValue=(key,overrides)=>{
  if(key==='smartScm.pathRules'){resolvedResource=overrides.resource;return cfg.pathRules;}
  return cfg[key.split('.').at(-1)];
 };
 cfg.pathRules=[{pattern:'module/src',mode:'replace',replacement:'业务'}];
 handlers.config({affectsConfiguration:()=>true});flush();
 assert.equal(resolvedResource,group.resources[0].sourceUri);
 assert.ok(host.children[0].children.map(x=>x.textContent).join('').includes('业务/'));
 cfg.pathRules=[{pattern:'module/src',mode:'ellipsis'}];
 handlers.config({affectsConfiguration:()=>true});flush();
 assert.ok(host.children[0].children.map(x=>x.textContent).join('').includes('…/'));
 disposals.forEach(d=>d.dispose());assert.equal(handlers.disconnected,true);assert.equal(head.children.length,0);
});
