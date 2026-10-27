import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'path';
import fs from 'fs';
import {randomUUID} from 'node:crypto';
import {defineConfig, Plugin} from 'vite';
import {createQueueApi} from './server/queueApi';

function queueApiPlugin():Plugin {
  const cachePath=path.resolve(__dirname,'.queue_server_cache.json');
  const middleware=createQueueApi({
    read:()=>fs.existsSync(cachePath)?fs.readFileSync(cachePath,'utf-8'):null,
    write:(value)=>{
      const temporary=cachePath+'.tmp';
      try {fs.writeFileSync(temporary,value,'utf-8');fs.renameSync(temporary,cachePath);}
      catch(error){try{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}catch{}throw error;}
    },
    id:randomUUID,
  });
  return {name:'queue-command-api',configureServer(server){server.middlewares.use(middleware);const timer=setInterval(()=>middleware.sweep(),1000);timer.unref();server.httpServer?.once('close',()=>clearInterval(timer));}};
}
export default defineConfig(()=>({
  base:'./',
  plugins:[basicSsl(),react(),tailwindcss(),queueApiPlugin()],
  resolve:{alias:{'@':path.resolve(__dirname,'.')}},
  server:{hmr:process.env.DISABLE_HMR!=='true',watch:process.env.DISABLE_HMR==='true'?null:{ignored:['**/.queue_server_cache*']}},
}));
