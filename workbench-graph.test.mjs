import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';

const createGraph = vm.runInNewContext(
  readFileSync(new URL('./workbench-graph.js', import.meta.url), 'utf8') + '\ncreateWorkbenchGraph',
);
const photo = {type:'image', id:'photo', src:'original'};
const grade = {type:'image', id:'grade', variant:'ai', src:'graded', aiInput:photo.src, colorBoardEdit:'grade-project'};
const ps = {type:'image', id:'ps', variant:'ps', src:'input-preview'};
const collage = {type:'image', id:'collage', variant:'collage', src:'composed', aiInput:'ps-png', collageEdit:'collage-project'};
const edge = (from, to) => ({from:from.id, to:to.id});

test('all stages resolve published results through a branching chain', () => {
  const nextGrade = {type:'image', id:'next-grade', variant:'ai'};
  const nextPS = {type:'image', id:'next-ps', variant:'ps'};
  const graph = createGraph({
    objects:[photo,grade,ps,collage,nextGrade,nextPS],
    connections:[edge(photo,grade),edge(grade,ps),edge(ps,collage),edge(collage,nextGrade),edge(collage,nextPS)],
    pikadoProjects:{ps:{inputSrc:'graded',preview:'ps-png'}},
  });
  assert.equal(graph.source(grade),'original');
  assert.equal(graph.source(ps),'graded');
  assert.equal(graph.source(collage),'ps-png');
  assert.equal(graph.source(nextGrade),'composed');
  assert.equal(graph.source(nextPS),'composed');
});

test('a preview-only or out-of-date result does not pass along the chain', () => {
  const objects = [photo,grade,ps,collage];
  const connections = [edge(photo,grade),edge(grade,ps),edge(ps,collage)];
  const graph = createGraph({objects,connections});
  assert.equal(graph.source(ps),'graded');
  assert.equal(graph.output(ps),'');
  assert.equal(graph.source(collage),'');
  assert.equal(graph.output(collage),'');

  const changed = createGraph({
    objects:[photo,{...grade,src:'regraded'},ps,collage],
    connections,
    pikadoProjects:{ps:{inputSrc:'graded',preview:'ps-png'}},
  });
  assert.equal(changed.source(ps),'regraded');
  assert.equal(changed.output(ps),'');
  assert.equal(changed.output(collage),'');
  assert.equal(collage.collageEdit,'collage-project');
});

test('standalone, legacy, and invalid cyclic projects resolve safely', () => {
  const standalone = {...collage,aiInput:''};
  const legacy = {type:'image',id:'legacy',variant:'ai',src:'legacy-preview'};
  const cyclic = createGraph({
    objects:[photo,legacy,standalone,ps],
    connections:[edge(photo,legacy),edge(ps,standalone),edge(standalone,ps)],
  });
  assert.equal(cyclic.output(legacy),'legacy-preview');
  assert.equal(cyclic.output(standalone),'');
  assert.equal(cyclic.output(ps),'');
  assert.equal(createGraph({objects:[standalone]}).output(standalone),'composed');
});
