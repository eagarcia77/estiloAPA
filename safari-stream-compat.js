/* Safari/iPadOS compatibility: ReadableStream.values() is optional in older engines.
 * Install before external document parsers are evaluated.
 */
(function(root){
  'use strict';
  const Stream=root.ReadableStream;
  if(!Stream || !Stream.prototype || typeof Stream.prototype.values==='function')return;
  Object.defineProperty(Stream.prototype,'values',{
    configurable:true,writable:true,
    value:function values(options){
      const stream=this;
      const preventCancel=Boolean(options&&options.preventCancel);
      return (async function*(){
        const reader=stream.getReader();
        let finished=false;
        try {
          while(true){
            const chunk=await reader.read();
            if(chunk.done){finished=true;return;}
            yield chunk.value;
          }
        } finally {
          try {
            if(!finished && !preventCancel)await reader.cancel();
          } finally {reader.releaseLock();}
        }
      })();
    }
  });
  if(typeof Symbol==='function'&&Symbol.asyncIterator&&!Stream.prototype[Symbol.asyncIterator]){
    Object.defineProperty(Stream.prototype,Symbol.asyncIterator,{
      configurable:true,writable:true,value:function(){return this.values();}
    });
  }
})(typeof globalThis!=='undefined'?globalThis:this);

/* PDF.js Map upsert proposal compatibility for Safari/iPadOS.
 * Must be defined before PDF.js modules are imported.
 */
(function () {
  'use strict';
  if (typeof Map !== 'function') return;
  if (typeof Map.prototype.getOrInsertComputed !== 'function') {
    Object.defineProperty(Map.prototype, 'getOrInsertComputed', {
      configurable: true,
      writable: true,
      value: function getOrInsertComputed(key, callback) {
        if (this.has(key)) return this.get(key);
        if (typeof callback !== 'function') throw new TypeError('callback must be a function');
        const value = callback(key);
        this.set(key, value);
        return value;
      }
    });
  }
  if (typeof Map.prototype.getOrInsert !== 'function') {
    Object.defineProperty(Map.prototype, 'getOrInsert', {
      configurable: true,
      writable: true,
      value: function getOrInsert(key, value) {
        if (this.has(key)) return this.get(key);
        this.set(key, value);
        return value;
      }
    });
  }
})();
