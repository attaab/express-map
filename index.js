const verbs = [
    'all','get','post','put','head','delete','options','trace',
    'copy','lock','mkcol','move','purge','propfind','proppatch',
    'unlock','report','mkactivity','checkout','merge','m-search',
    'notify','subscribe','unsubscribe','patch','search','connect'
]; 
//the http methods supported by express + all for all.

const controllers = {};//cache controllers.

let cPath = false;//cache controller path

const Map = (...args)=>{
    
    let path = cPath || this.get('controllers'),//if cPath = false, retrieve controllers from app, only once.
    prefix,
    routes;
    
    // if path === undefined, then controllers hasn't been set on app instance.
    if(path === undefined){
        throw new Error("You must use app.set('controllers','/path/to/controllers') to set the controller path before using `express-map2`");
    }
    
    // if cPath hasn't been set, set it. 
    if(!cPath){
        cPath = path;
    }
    
    // with or without prefix.
    switch(true){
        case (args.length == 2):
            prefix = args[0];
            routes = args[1];
        break;
        case (args.length == 1):
            prefix = '';
            routes = args[0];
        break;
        default:
            throw new Error('`express-map` invalid argument exception. The function signature accepts either `prefix,routes` or `routes`')
        break;
    }
    
    if(typeof prefix !== 'string'){
        throw new Error('`express-map` invalid argument exception. option `prefix` must be a string.');
    }
    
    if(typeof routes !== 'object' || routes instanceof Array){
        throw new Error('`express-map` invalid argument exception option `routes` must be an object.')
    }

    for(let prop in routes){
        
        let resource = prop.replace(/\s+/g,' ').replace(/^\s+|\s+$/,'');
        
        if(resource.indexOf(' ') != -1 ){
            
            resource = resource.split(' ');
            
            resource = resource.map((v)=>{ return v.trim().trimLeft(); });
            
        }else{
            
            // throw error since we can't parse it.
            throw new Error('`express-map` unable to parse option `routes` at line `"'+prop+'":"'+routes[prop]+'",`');
        }
        
        let verb = resource[0].toLowerCase();
        
        //create routePath from prefix and actual path. replace duplicate slashes
        let routePath = (prefix + resource[1].trim()).replace(/\/+/g, '/');
        
        if(routePath != '/'){
            routePath = routePath.replace(/\/+$/, '');//only trim trailing slash if not `/`
        }
        
        if(verbs.indexOf(verb) == -1){
            throw new Error('`express-map` encountered an invalid http verb `'+verb.toUpperCase()+'`.');
        }
        
        let handlers = routes[prop];
        
        if(typeof handlers != 'string'){
            let msg = '`express-map` encountered an invalid handler format `'+handlers+'`.\n'+
            'please define your controllers in the form of <module>.<function> or just <module> if module is a function, and seperate them by a comma';
            
            throw new Error(msg);
        }else{
            
            if(handlers.indexOf(',') >=0){
                handlers = handlers.split(',');
                handlers = handlers.map((v) => { return v.trim().trimLeft() });
            }else{
                handlers = [handlers];
            }
            
            var strHandlers = [];//for the logger output
            
            handlers = handlers.map((v)=>{

                if(v.indexOf('.') > 0){
                    v = v.split('.');   
                }else{
                    v = [v];
                }
                
                if(!controllers.hasOwnProperty(v[0])){
                    controllers[v[0]] = require(path +v[0]);
                }
                
                //technically we could use `eval('h = '+strH+';');` but that seems like a dirtier way to handle both concerns.
                h = controllers;
                let strH = '';
                
                for(var i=0;i<v.length;i++){
                    h = h[v[i]]; //recursively point to the subsequent child until we reach the function.
                    
                    if(i>0) strH += '.';
                    
                    strH +=v[i];
                }

                if(typeof h !='function'){
                    throw new Error('`express-map` `'+strH+'` does not resolve to a function and is not a valid handler for route `'+routePath+'`');
                }
                strHandlers.push(strH);
                return h;//h should now point directly to each handler function, regardless of depth.
                
            });
            
            handlers.unshift(routePath);//add the routePath as first element in array
            
            this[verb].apply(this,handlers);//call the associated express method with handlers as arguments
            
        }
    }   
};

module.exports = (app) => {
    
    app.map = Map.bind(app);//bind express app as `this` context.
    var oldListener = app.listen;
    
    //cleanup controllers once the app starts.
    app.listen = (...args)=>{
        controllers = null; // ? 
        app.listen = oldListener;
        app.listen.apply(app,args);
    };
    
};