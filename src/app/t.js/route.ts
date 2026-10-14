import { APP_URL } from '@/lib/tracking';

// The script your website loads: <script defer src="https://<lead finder>/t.js"></script>
// One small beacon per page view (also on Framer's in-page navigation). No cookies.
export function GET() {
  const js = `(function(){var u=${JSON.stringify(`${APP_URL}/api/visit`)},last="";function send(){var p=location.pathname;if(p===last)return;last=p;var b=JSON.stringify({path:p,referrer:document.referrer});try{if(navigator.sendBeacon){navigator.sendBeacon(u,new Blob([b],{type:"text/plain"}));return}}catch(e){}fetch(u,{method:"POST",body:b,keepalive:true,headers:{"Content-Type":"text/plain"}}).catch(function(){})}send();var ps=history.pushState;history.pushState=function(){ps.apply(this,arguments);setTimeout(send,50)};addEventListener("popstate",function(){setTimeout(send,50)})})();`;
  return new Response(js, { headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
