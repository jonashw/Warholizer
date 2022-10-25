const onFilePaste = (element, onData) => {
  element.addEventListener('paste', event => {
    var items = (event.clipboardData || event.originalEvent.clipboardData).items;
    console.log(JSON.stringify(items)); // will give you the mime types
    for (let index in items) {
      var item = items[index];
      if (item.kind === 'file') {
        var blob = item.getAsFile();
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