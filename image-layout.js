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
// Fit the preview and its controls together, rather than sizing the image to 70vh alone.
function fitPreviewDialog(){
 const img=dialog.querySelector('.projectpreview');if(!dialog.open||!img?.naturalWidth)return;
 const vw=window.visualViewport?.width||innerWidth,vh=window.visualViewport?.height||innerHeight;
 const ratio=img.naturalWidth/img.naturalHeight,maxWidth=Math.min(1100,vw-32);
 dialog.style.width=Math.min(maxWidth,Math.max(300,(vh-170)*ratio+40))+'px';
 for(let i=0;i<2;i++){
  const style=getComputedStyle(dialog),paddingY=parseFloat(style.paddingTop)+parseFloat(style.paddingBottom);
  const body=$('#dialogbody'),others=[...body.children].filter(el=>el!==img);
  const controls=others.reduce((sum,el)=>{const s=getComputedStyle(el);return sum+el.getBoundingClientRect().height+parseFloat(s.marginTop)+parseFloat(s.marginBottom)},0);
  const gap=parseFloat(getComputedStyle(body).rowGap)||0;
  const available=Math.max(40,vh-40-paddingY-dialog.querySelector('form').getBoundingClientRect().height-controls-gap*others.length-12);
  const width=Math.min(body.clientWidth,available*ratio),height=width/ratio;
  img.style.width=width+'px';img.style.height=height+'px';
 }
}
const previewBaseModal=modal;modal=function(title,html){dialog.classList.toggle('image-preview-dialog',html.includes('class="projectpreview"'));dialog.style.removeProperty('width');previewBaseModal(title,html);const img=dialog.querySelector('.projectpreview');if(img){img.addEventListener('load',fitPreviewDialog,{once:true});if(img.complete)fitPreviewDialog()}};
window.addEventListener('resize',fitPreviewDialog);window.visualViewport?.addEventListener('resize',fitPreviewDialog);
