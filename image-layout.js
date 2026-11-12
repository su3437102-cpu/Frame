// Use decoded image dimensions, including edited PS output, instead of a landscape frame.
function imageFrameHeight(width,ratio,isPS){return isPS?Math.max(1,width-24)*ratio+80:width*ratio}
function fitDecodedImage(img){
 const card=img.closest('#world .object.image');if(!card||!img.naturalWidth||!img.naturalHeight)return false;
 const o=state.objects.find(item=>item.id===card.dataset.id);if(!o||img.getAttribute('src')!==o.src)return false;
 const ratio=img.naturalHeight/img.naturalWidth,h=imageFrameHeight(o.w,ratio,o.variant==='ps');
 const changed=Math.abs(o.h-h)>.1||o.imageRatio!==ratio;o.imageRatio=ratio;o.h=h;card.style.height=h+'px';return changed;
}
document.addEventListener('load',e=>{if(e.target instanceof HTMLImageElement&&fitDecodedImage(e.target)){renderConnections();drawMap();save()}},true);
const imageLayoutBaseRender=render;render=function(){imageLayoutBaseRender();let changed=false;world.querySelectorAll('.object.image img').forEach(img=>{if(img.complete)changed=fitDecodedImage(img)||changed});if(changed){renderConnections();drawMap();save()}};
render();
