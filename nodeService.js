import {Service} from 'node-windows';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const svc = new Service({
    name:'api_edomex',
    script: path.join(__dirname,'index.js')
  });
  
  // Listen for the "install" event, which indicates the
  // process is available as a service.
  svc.on('uninstall',function(){
    console.log('Uninstall complete.');
    console.log('The service exists: ',svc.exists);
  });


  svc.uninstall();



