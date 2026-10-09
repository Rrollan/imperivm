/** Local iframe harness. It uses real child viewport geometry; no SDK credentials. */
export default function EmbedPreview({searchParams}:{searchParams:{screen?:string;scene?:string}}){
 const screen=searchParams.screen==='phone'?{width:844,height:390}:searchParams.screen==='portrait'?{width:390,height:844}:{width:1280,height:'100dvh'};
 const src=searchParams.scene==='collection'?'/collection':searchParams.scene==='loading'?'/arena-lab/loading-preview':'/arena-lab?hero=builder&opening=1';
 return <main style={{margin:'0 auto',maxWidth:1280,width:'100%',minHeight:'100dvh',background:'#1e130f',display:'grid',placeItems:'center'}}><iframe title="IMPERIVM — iDos layout preview" src={src} allow="fullscreen" style={{display:'block',width:screen.width,maxWidth:'100%',height:screen.height,border:0}}/></main>;
}
