import type { BrandKit } from "@/lib/types";

export type EditorialItem = { title: string; detail: string };
export type EditorialPlan = {
  archetype: "system-map" | "process" | "evidence" | "comparison" | "framework" | "conceptual";
  headline: string; subheadline: string; centralInsight: string; audience: string;
  nodes: EditorialItem[]; steps: EditorialItem[]; before: EditorialItem; after: EditorialItem;
  labels: string[]; evidenceNote: string; illustrationBrief: string; rationale: string;
};
const esc = (value: string) => value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
function wrap(value: string, limit = 22): string[] {
  const words = value.split(/\s+/); const lines: string[] = []; let line = "";
  for (const word of words) { if ((line + " " + word).trim().length > limit && line) { lines.push(line); line = word; } else line = (line + " " + word).trim(); }
  if (line) lines.push(line); return lines.slice(0,3);
}
function text(x:number,y:number,value:string,size:number,color:string,weight=400,anchor="start",family="Arial"):string {
  const lines=wrap(value, size>=34?25:size>=20?28:31);
  return `<text x="${x}" y="${y}" font-family="${esc(family)},Arial,sans-serif" font-size="${size}" fill="${color}" font-weight="${weight}" text-anchor="${anchor}">${lines.map((line,i)=>`<tspan x="${x}" dy="${i===0?0:size+5}">${esc(line)}</tspan>`).join("")}</text>`;
}
export function buildEditorialSvg(plan: EditorialPlan, kit: BrandKit, productName: string): string {
  const bg=kit.backgroundColor||"#F8F8F2", ink=kit.textColor||"#1E2822", primary=kit.primaryColor||"#173D2D", accent=kit.accentColor||"#F47755";
  const font=kit.fontFamily||"Arial"; const parts:string[]=[];
  parts.push(`<rect width="1080" height="1080" fill="${bg}"/>`);
  parts.push(`<text x="64" y="62" font-family="${esc(font)},Arial,sans-serif" font-size="17" letter-spacing="3" fill="${primary}" font-weight="700">${esc((productName||"BUILDER NOTES").toUpperCase().slice(0,44))}</text>`);
  parts.push(text(64,145,plan.headline,54,ink,700,"start",font));
  if(plan.subheadline) parts.push(text(64,225,plan.subheadline,23,ink,400,"start",font));
  parts.push(`<line x1="64" y1="286" x2="1016" y2="286" stroke="${primary}" stroke-opacity=".3" stroke-width="2"/>`);
  const card=(x:number,y:number,w:number,h:number,item:EditorialItem,index:number,tag?:string)=>{
    parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" fill="#FFFFFF" stroke="${ink}" stroke-opacity=".25" stroke-width="1.5"/>`);
    parts.push(`<text x="${x+20}" y="${y+31}" font-family="${esc(font)}" font-size="16" font-weight="700" fill="${accent}">${esc(tag||String(index+1).padStart(2,"0"))}</text>`);
    parts.push(text(x+20,y+70,item.title,24,ink,700,"start",font));
    if(item.detail) parts.push(text(x+20,y+130,item.detail,17,ink,400,"start",font));
  };
  if(plan.archetype==="process" && plan.steps.length){
    const items=plan.steps.slice(0,4), w=Math.min(280,(952-(items.length-1)*20)/items.length), gap=(952-items.length*w)/(items.length-1||1), y=390;
    items.forEach((item,i)=>{const x=64+i*(w+gap);card(x,y,w,310,item,i);if(i<items.length-1){const ax=x+w+5, ay=y+155;parts.push(`<path d="M ${ax} ${ay} L ${ax+gap-10} ${ay}" stroke="${accent}" stroke-width="3" fill="none"/><path d="M ${ax+gap-20} ${ay-7} L ${ax+gap-10} ${ay} L ${ax+gap-20} ${ay+7}" stroke="${accent}" stroke-width="3" fill="none"/>`);}});
  } else if(plan.archetype==="comparison" && plan.before.title && plan.after.title){
    card(64,385,450,350,plan.before,0,"BEFORE");card(566,385,450,350,plan.after,1,"AFTER");
    parts.push(`<path d="M 500 555 L 580 555" stroke="${accent}" stroke-width="5"/><path d="M 566 542 L 580 555 L 566 568" stroke="${accent}" stroke-width="5" fill="none"/>`);
  } else if(plan.archetype==="framework" && plan.labels.length){
    const items=plan.labels.slice(0,4).map((title,i)=>({title,detail:(plan.nodes[i]?.detail||"").slice(0,150)}));
    const coords=[[64,370],[550,370],[64,625],[550,625]];
    items.forEach((item,i)=>card(coords[i][0],coords[i][1],466,220,item,i));
  } else {
    const items=(plan.nodes.length?plan.nodes:plan.steps).slice(0,4);
    const coords=items.length<=2?[[64,405],[550,405]]:[[64,365],[550,365],[64,625],[550,625]];
    items.forEach((item,i)=>card(coords[i][0],coords[i][1],466,220,item,i));
    if(plan.archetype==="system-map" && items.length>1){
      parts.push(`<path d="M 530 475 L 550 475 M 1016 475 L 1035 475 M 297 585 L 297 625 M 783 585 L 783 625" stroke="${accent}" stroke-width="3" fill="none"/>`);
    }
  }
  if(plan.centralInsight) {
    parts.push(`<rect x="64" y="890" width="952" height="105" rx="8" fill="${primary}"/>`);
    parts.push(text(88,930,plan.centralInsight,21,"#FFFFFF",600,"start",font));
  }
  if(plan.evidenceNote) parts.push(text(64,1032,"SOURCE / CONTEXT: "+plan.evidenceNote,13,ink,400,"start",font));
  parts.push(`<text x="1016" y="1050" font-family="${esc(font)}" font-size="13" fill="${ink}" text-anchor="end">${esc("RELEASEBUFF  ·  EDITORIAL EXPLAINER")}</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">${parts.join("")}</svg>`;
}
