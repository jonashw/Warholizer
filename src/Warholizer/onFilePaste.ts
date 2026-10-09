const onFilePaste = (onData: (data: string|ArrayBuffer) => void): void => {
  document.addEventListener('paste', (event: ClipboardEvent) => {
    const items = event.clipboardData?.items || [];
    console.log(JSON.stringify(items)); // will give you the mime types
    for (const index in items) {
      const item = items[index];
      if (item.kind === 'file') {
        const blob = item.getAsFile();
        if(!blob){
          continue;
        }
        const reader = new FileReader();
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