const onFilePaste = (onData: (data: string|ArrayBuffer) => void): void => {
  document.addEventListener('paste', (event: ClipboardEvent) => {
    var items = event.clipboardData?.items || [];
    console.log(JSON.stringify(items)); // will give you the mime types
    for (let index in items) {
      var item = items[index];
      if (item.kind === 'file') {
        var blob = item.getAsFile();
        if(!blob){
          continue;
        }
        var reader = new FileReader();
        reader.onload = function(event){
          // data url!
          if(event.target?.result){
            onData(event.target.result);
          }
        };
        reader.readAsDataURL(blob);
      }
    }
  });
  return;
}

export default onFilePaste;