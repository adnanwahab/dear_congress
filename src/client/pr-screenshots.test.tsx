import {test,expect} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {attachedScreenshots} from './pr-screenshots';
import {PatchPreview} from './GamePatches';
import type {PublicPull} from '../shared/hbl-governance';
const sha='a'.repeat(40), old='b'.repeat(40);
const image=(name:string,commit=sha,repo='adnanwahab/happybearlandia')=>`https://github.com/${repo}/blob/${commit}/.mini-symphony-evidence/${name}.png?raw=true`;
const pull=(body:string):PublicPull=>({number:321,repositoryId:1,url:'https://github.com/adnanwahab/happybearlandia/pull/321',body,title:'World',author:'fixture',updatedAt:'',headSha:sha,base:'main',draft:true,state:'open',version:'fixture',firstSeenAt:0,labels:[],tally:{yes:0,no:0,participation:0,feedback:0},eligibility:{eligible:false,state:'blocked',reason:'fixture'}});
test('first two unique screenshot attachments retain description order and immutable sources',()=>{
 const p=pull(`![Before](${image('before',old)})\n![Before duplicate](${image('before',old)})\n<img src="${image('after')}" alt="After">\n![Third](${image('third')})`);
 const images=attachedScreenshots(p);expect(images).toHaveLength(2);expect(images.map(i=>i.alt)).toEqual(['Before','After']);expect(images[0]?.commit).toBe(old);expect(images[1]?.src).toBe(`https://raw.githubusercontent.com/adnanwahab/happybearlandia/${sha}/.mini-symphony-evidence/after.png`);
});
test('unsafe, cross-repository, mutable, traversal and non-image URLs are excluded',()=>{
 const bad=['https://evil.test/a.png',image('wrong',sha,'adnanwahab/dear_congress'),image('mutable','main'),image('traversal').replace('/traversal.png','/%2e%2e/private.png'),image('vector').replace('.png','.svg'),'https://github.com.evil.test/adnanwahab/happybearlandia/blob/'+sha+'/a.png','https://user:pass@github.com/adnanwahab/happybearlandia/blob/'+sha+'/a.png'];
 expect(attachedScreenshots(pull(bad.map(u=>`![unsafe](${u})`).join('\n')))).toEqual([]);
 expect(attachedScreenshots({...pull(`![safe](${image('one')})`),kind:'issue'})).toEqual([]);
 expect(attachedScreenshots({...pull(`![safe](${image('one')})`),number:999})).toEqual([]);
});
test('pair markup stays bounded, clickable and separate from verified deployment authority',()=>{
 const p=pull(`![One](${image('one')})\n![Two](${image('two')})\n![Three](${image('three')})`);p.preview={headSha:old,route:'/',capturedAt:'',screenshotUrl:'/old.png',exploreUrl:'https://stale.fly.dev'};
 const html=renderToStaticMarkup(<PatchPreview pull={p}/>);expect((html.match(/<img /g)||[])).toHaveLength(2);expect(html).toContain('gp-screenshot-pair');expect(html).toContain('no-referrer');expect(html).not.toContain('stale.fly.dev');expect(html).not.toContain('/three.png');expect(html).not.toContain('being prepared');
});
test('exact-revision operator preview is retained when attachments are absent',()=>{
 const p=pull('No screenshots');p.preview={headSha:sha,route:'/',capturedAt:'',screenshotUrl:'/current.png',exploreUrl:'https://verified.fly.dev'};const html=renderToStaticMarkup(<PatchPreview pull={p}/>);expect(html).toContain('/current.png');expect(html).toContain('https://verified.fly.dev');p.headSha=old;expect(renderToStaticMarkup(<PatchPreview pull={p}/>)).not.toContain('https://verified.fly.dev');
});
