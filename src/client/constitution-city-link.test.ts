import {expect,test} from 'bun:test';
import {constitutionCityUrl} from './constitution-city-link';
import type {SimulationSnapshot} from '../engine/types';
test('constitution handoff carries only public package, actual location and opaque snapshot provenance',()=>{
 const snapshot={id:'sim_actual',entryId:'PRIVATE_JOURNAL',location:{lat:29.7,lng:-95.4},plan:{id:'B',label:'PRIVATE_LABEL'}} as SimulationSnapshot;
 const url=new URL(constitutionCityUrl('https://hbl.test/',{snapshot,sourceOrigin:'https://dc.test/a?journal=PRIVATE_QUERY'}));
 expect(url.pathname).toBe('/world/constitution-city.html');expect(Object.fromEntries(url.searchParams)).toEqual({source:'dear-congress',package:'B',sourceSnapshot:'sim_actual',sourceOrigin:'https://dc.test',lat:'29.7',lng:'-95.4'});expect(url.href).not.toContain('PRIVATE');
});
test('no location is invented and malformed origins/packages are rejected',()=>{
 const url=new URL(constitutionCityUrl('https://hbl.test',{location:{lat:91,lng:0}}));expect(url.searchParams.has('lat')).toBe(false);expect(url.searchParams.get('package')).toBe('A');
 expect(()=>constitutionCityUrl('javascript:alert(1)')).toThrow();expect(()=>constitutionCityUrl('https://hbl.test',{packageId:'bad&journal=private'})).toThrow();
});
