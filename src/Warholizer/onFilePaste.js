const onFilePaste = (element, onData) => {
  window.addEventListener('paste', event => {
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
          onData(event.target.result);
        };
        reader.readAsDataURL(blob);
      }
    }
  });
}

export default onFilePaste;