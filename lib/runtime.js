'use strict';
function installRuntime(createPlanner) {
  const planner = createPlanner();
  const rendered = new Map();
  const titles = new WeakMap();
  function restoreTitle(element) {
    const saved = element && titles.get(element);
    if (!saved) return;
    if (element.getAttribute('title') === saved.assigned) {
      if (saved.original === null) element.removeAttribute('title');
      else element.setAttribute('title', saved.original);
    }
    titles.delete(element);
  }
  function setTitle(element, path) {
    if (!element) return;
    restoreTitle(element);
    titles.set(element, {original:element.getAttribute('title'), assigned:path});
    element.setAttribute('title',path);
  }
  let view, cache = new WeakMap(), frame, metricCache;
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
  const active = () => !!view && view.viewMode === 'list' && view.configurationService.getValue('smartScm.enabled') === true;
  function metrics() {
    if (metricCache) return metricCache;
    const label = view?.treeContainer?.querySelector('.resource .monaco-icon-label');
    const style = label ? getComputedStyle(label) : null;
    const font = style?.font || '13px sans-serif';
    if (ctx) ctx.font = font;
    // Width of label area after indent, icon, decorations and all inline actions.
    const row = label?.closest('.monaco-list-row');
    const left = label && row ? Math.max(0, label.getBoundingClientRect().left - row.getBoundingClientRect().left) : 28;
    const actions = label?.querySelector('.actions');
    const reserve = Math.max(64, actions?.scrollWidth || 0) + 24;
    return metricCache = { width: Math.max(0, (view?.treeContainer?.clientWidth || 0) - left - reserve), font };
  }
  function entry(resource) {
    if (!active() || !resource?.resourceGroup) return;
    const group = resource.resourceGroup, m = metrics();
    const root = view.scmViewService.repositories.find(repo => [...repo.provider.groups].includes(group))?.provider.rootUri;
    let c = cache.get(group);
    if (!c || c.width !== m.width || c.font !== m.font) {
      c = { ...m, plan: planner.plan(group.resources, m.width, s => ctx ? ctx.measureText(s).width : s.length * 8, view.configurationService.getValue('smartScm.minPrefixLength') || 12, root, view.configurationService.getValue('smartScm.maxDisplayLines') ?? 2, r => view.configurationService.getValue('smartScm.hiddenCommonDirectories', {resource:r.sourceUri}) || [], r => view.configurationService.getValue('smartScm.pathRules', {resource:r.sourceUri}) || []) };
      cache.set(group, c);
    }
    return c.plan.get(resource);
  }
  function refresh() {
    frame = undefined;
    if (!view?.tree) return;
    cache = new WeakMap(); metricCache = undefined;
    for (const repo of view.scmViewService.repositories) for (const group of repo.provider.groups) for (const r of group.resources) {
      if (view.tree.hasNode(r)) view.tree.updateElementHeight(r, entry(r)?.height || 22);
    }
    view.tree.rerender();
    for (const [template, data] of rendered) render(template, data);
  }
  const schedule = () => { if (frame === undefined) frame = requestAnimationFrame(refresh); };
  function attach(v) {
    if (view === v) return;
    view = v;
    const css = document.createElement('style');
    css.textContent = '.scm-view .smart-scm-label{display:flex;flex-direction:column;min-width:0;flex:1;overflow:hidden;pointer-events:auto;line-height:22px}.scm-view .smart-scm-label span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.scm-view .smart-scm-label .smart-prefix{opacity:.7}.scm-view .monaco-icon-label:has(>.smart-scm-label)>.monaco-icon-label-container{display:none!important}.scm-view .monaco-icon-label:has(>.smart-scm-label){align-items:flex-start!important}.scm-view .monaco-icon-label:has(>.smart-scm-label)::before,.scm-view .monaco-icon-label:has(>.smart-scm-label)>.monaco-icon-label-iconpath{margin-top:var(--smart-scm-icon-offset,0px)!important;height:22px!important;line-height:22px!important}.scm-view .smart-scm-active .actions{align-self:center}';
    document.head.append(css);
    const observer = new ResizeObserver(schedule); observer.observe(v.treeContainer);
    v.disposables.add(v.configurationService.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('smartScm')) { cache = new WeakMap(); v.updateChildren(); schedule(); }
    }));
    v.disposables.add(v.onDidChangeViewMode(() => { cache = new WeakMap(); schedule(); }));
    v.disposables.add({dispose() { observer.disconnect(); css.remove(); if (frame !== undefined) cancelAnimationFrame(frame); view = undefined; rendered.clear(); }});
    schedule();
  }
  function render(template, data) {
    rendered.set(template, data);
    const host = template.fileLabel.element;
    const row = host.closest?.('.monaco-list-row');
    restoreTitle(host); restoreTitle(row);
    host.querySelector('.smart-scm-label')?.remove();
    host.classList.remove('smart-scm-active');
    host.style.removeProperty('--smart-scm-icon-offset');
    const item = entry(data.iconResource);
    if (!item || data.fileLabelOptions.hidePath) return;
    const box = document.createElement('span'); box.className = 'smart-scm-label'; box.setAttribute('aria-hidden', 'true');
    const lines = item.lines || [...(item.first ? [{text:item.prefix, prefix:true}] : []), {text:item.suffix, prefix:false}];
    // The file is on the final display line; preceding lines are path/name prefixes.
    host.style.setProperty('--smart-scm-icon-offset', `${Math.max(0, lines.length - 1) * 22}px`);
    for (const line of lines) {
      const span = document.createElement('span');
      if (line.prefix) span.className = 'smart-prefix';
      span.textContent = line.text; box.append(span);
    }
    box.title = data.uri.fsPath || data.uri.toString();
    setTitle(host, box.title); setTitle(row, box.title);
    // Use native resource label hover and original accessible name; no input handlers replaced.
    host.insertBefore(box, host.querySelector('.actions')); host.classList.add('smart-scm-active');
  }
  globalThis.__smartScm = { attach, render, active, compare: planner.compare, height: r => entry(r)?.height || 22,
    changed() { cache = new WeakMap(); metricCache = undefined; schedule(); } };
}
module.exports = { installRuntime };
