import { Collage } from './artwork.mjs';

const group = {
  id:'film', title:'胶片片框',
  description:'选用片框后，可以分别调整照片、片边、格号和日期。在图层面板选中照片即可替换。'
};

const designs = [
  {id:'film-135', name:'135 齿孔片框', aspect:'landscape', gate:[.055,.152,.89,.696], size:[1200,800],
    holes:8, asset:{id:'journal-ridge-wide',name:'晨雾全景'}},
  {id:'film-120', name:'120 方幅片框', aspect:'square', gate:[.079,.079,.842,.842], size:[1200,1200],
    holes:0, asset:{id:'template-ferns',name:'溪边蕨叶'}},
  {id:'film-wide', name:'135 宽幅片框', aspect:'wide', gate:[.044,.178,.912,.644], size:[1200,675],
    holes:10, asset:{id:'template-pond',name:'池面灯影'}}
].map(design => ({
  ...design, title:design.name, group:group.id, background:'#eee9de', palette:['#21201c','#d6b881','#e6d9bd']
}));

function layout(design, material = design.asset) {
  const [width,height] = design.size;
  const scale = Math.min(width/1200,height/800);
  const box = ([x,y,w,h]) => [(x+w/2)*1200,(y+h/2)*800,w*width/scale,h*height/scale];
  const middle = [.017,.023,.966,.954];
  const [,top,,gateHeight] = design.gate;
  const warm = design.palette[1];
  const stock = Collage.paper('胶片片基',design.palette[0],...box(middle));
  const photograph = Collage.photo(material,...box(design.gate),{name:'照片 · '+material.name,slot:'照片'});
  const date = Collage.label('00 00 00', '#ffc775',...box([.70,top+gateHeight-.067,.215,.049]),0,
    {name:'日期印记',filmLabel:true,mono:true,align:'right'});
  const frameNumber = Collage.label('FRAME  01',warm,...box([.087,top+gateHeight+.010,.48,.036]),0,
    {name:'格号',filmLabel:true,mono:true,align:'left'});
  const layers = [stock,photograph];
  if (design.holes) {
    layers.push(Collage.paper('齿孔',design.palette[2],...box(middle),'rect',0,{
      filmHoles:design.holes, filmHoleTop:top*.29, filmHoleBottom:1-top*.28
    }));
  }
  return [...layers,frameNumber,date];
}

export const FilmFrames = {group,designs,layout};
