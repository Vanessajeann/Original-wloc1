import http from 'node:http';
import app from '../worker/src/index.js';
const server=http.createServer(async(req,res)=>{
  try {
    const response=await app.fetch(new Request(`http://127.0.0.1:8787${req.url}`,{method:req.method}));
    res.writeHead(response.status,Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {res.writeHead(500);res.end('Preview error');}
});
server.listen(8787,'127.0.0.1',()=>console.log('Preview: http://127.0.0.1:8787'));
