import type {SimulationSnapshot} from '../engine/types';
export function constitutionCityUrl(base:string,{snapshot,packageId,sourceOrigin,location}:{snapshot?:SimulationSnapshot;packageId?:string;sourceOrigin?:string;location?:{lat:number;lng:number}|null}={}){
 const url=new URL(`${base.replace(/\/+$/,'')}/world/constitution-city.html`);
 if(!['http:','https:'].includes(url.protocol))throw new Error('World destination must use HTTP(S)');
 url.searchParams.set('source','dear-congress');
 const id=packageId??snapshot?.plan.id??'A';if(!/^[A-Za-z0-9_-]{1,60}$/.test(id))throw new Error('Invalid public package ID');url.searchParams.set('package',id);
 if(snapshot?.id&&/^[A-Za-z0-9_-]{1,100}$/.test(snapshot.id))url.searchParams.set('sourceSnapshot',snapshot.id);
 if(sourceOrigin){const source=new URL(sourceOrigin);if(!['http:','https:'].includes(source.protocol))throw new Error('Source must use HTTP(S)');url.searchParams.set('sourceOrigin',source.origin);}
 const point=location??snapshot?.location;if(point&&Number.isFinite(point.lat)&&Number.isFinite(point.lng)&&Math.abs(point.lat)<=90&&Math.abs(point.lng)<=180){url.searchParams.set('lat',String(point.lat));url.searchParams.set('lng',String(point.lng));}
 return url.href;
}
